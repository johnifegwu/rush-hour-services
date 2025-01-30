import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Board, Game } from '../schemas';
import { MoveCarDto } from '../dto/move-car.dto';
import { RedisService } from './redis.service';
import { RabbitMQService } from './rabbitmq.service';
import { BadRequestException, NotFoundException } from '../exceptions';
import { AnalysisResult, GameMove, MovementDirection, MoveQuality, Step } from '../interfaces/rush-hour.interface';

type Position = [number, number];

interface Car {
    positions: Position[];
    orientation: 'horizontal' | 'vertical';
    id?: number;
    movementRange?: number;
}


interface PriorityQueueNode {
    value: State;
    priority: number;
}

class PriorityQueue {
    private heap: PriorityQueueNode[] = [];

    enqueue(value: State, priority: number): void {
        this.heap.push({ value, priority });
        this.bubbleUp(this.heap.length - 1);
    }

    dequeue(): State | null {
        if (this.heap.length === 0) return null;

        const min = this.heap[0];
        const last = this.heap.pop();

        // Add null check for last element
        if (this.heap.length > 0 && last !== undefined) {
            this.heap[0] = last;
            this.bubbleDown(0);
        }

        return min.value;
    }

    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[parentIndex].priority <= this.heap[index].priority) break;

            [this.heap[parentIndex], this.heap[index]] =
                [this.heap[index], this.heap[parentIndex]];
            index = parentIndex;
        }
    }

    private bubbleDown(index: number): void {
        while (true) {
            let smallest = index;
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;

            if (leftChild < this.heap.length &&
                this.heap[leftChild].priority < this.heap[smallest].priority) {
                smallest = leftChild;
            }

            if (rightChild < this.heap.length &&
                this.heap[rightChild].priority < this.heap[smallest].priority) {
                smallest = rightChild;
            }

            if (smallest === index) break;

            [this.heap[index], this.heap[smallest]] =
                [this.heap[smallest], this.heap[index]];
            index = smallest;
        }
    }

    get length(): number {
        return this.heap.length;
    }
}

interface State {
    matrix: number[][];
    moves: number;
    lastMove?: {
        carId: number;
        direction: MovementDirection;
    };
}

@Injectable()
export class GameService {
    //private readonly stateCache: Map<string, number> = new Map();
    private readonly MAX_BOARD_SIZE = 6; // Standard Rush Hour board size
    private readonly MAX_SEARCH_STATES = 100000;
    private readonly PARALLEL_CHUNK_SIZE = 1000;
    constructor(
        @InjectModel(Board.name) private readonly boardModel: Model<Board>,
        @InjectModel(Game.name) private readonly gameModel: Model<Game>,
        private readonly redisService: RedisService,
        private readonly rabbitMQService: RabbitMQService,
    ) { }

    async createBoard(matrix: number[][]) {
        return await this.boardModel.create({ matrix });
    }

    async startGame(boardId: string) {
        const board = await this.boardModel.findById(boardId);
        if (!board) throw new Error('Board not found');

        const game = await this.gameModel.create({
            boardId,
            currentState: board.matrix,
            moves: [],
            lastMoveAt: new Date(),
            isSolved: false
        });

        //Save to redis
        this.redisService.setGame(game.id, game);

        return game;
    }

    async getGame(gameId: string): Promise<Game> {
        //Look for game in redis
        const game = await this.redisService.getGame(gameId);

        //Throw NotFoundException if game was not found
        if (!game) throw new NotFoundException('Game not found');

        //Return game if found
        return game as Game;
    }

    private async updateGame(gameId: string, game: Game) {
        //Update game to redis as games are archived to the database 
        // when completed or inactive.
        this.redisService.setGame(gameId, game);
        return game;
    }

    async getBoards(difficulty?: string): Promise<Board[]> {
        try {
            const boards = await this.boardModel.find().exec();

            if (difficulty) {
                return boards.filter(async board => await this.getBoardDifficulty(board) === difficulty);
            }

            return boards;
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch boards: ${error.message}`);
            } else {
                throw new Error('Failed to fetch boards: Unknown error');
            }
        }
    }

    async getBoard(boardId: string): Promise<Board> {
        const board = await this.boardModel.findById(boardId).exec();

        if (!board) {
            throw new NotFoundException(`Board with ID ${boardId} not found`);
        }

        return board;
    }

    async getHint(gameId: string): Promise<Step> {
        const game = await this.getGame(gameId);

        if (game.isSolved) {
            throw new Error('Game is already solved');
        }

        // Get all possible next moves
        const currentState: State = {
            matrix: game.currentState,
            moves: game.moves.length
        };

        const possibleMoves = await this.generateNextMoves(currentState);

        // Calculate minimum moves for each possible move
        const movesWithQuality = await Promise.all(
            possibleMoves.map(async (moveState) => {
                const currentMinMoves = await this.calculateMinimumMoves(game.currentState, gameId);
                const moveQuality = await this.calculateMoveQuality(
                    moveState.matrix,
                    currentMinMoves,
                    gameId
                );

                // Find what changed between current state and new state to determine the move
                const move = this.determineMove(game.currentState, moveState.matrix);

                return {
                    ...move,
                    quality: moveQuality
                };
            })
        );

        // First try to find a GOOD move
        const goodMove = movesWithQuality.find(move => move.quality === MoveQuality.GOOD);
        if (goodMove) {
            return {
                carId: goodMove.carId,
                direction: goodMove.direction
            };
        }

        // If no GOOD moves, try to find a WASTE move
        const wasteMove = movesWithQuality.find(move => move.quality === MoveQuality.WASTE);
        if (wasteMove) {
            return {
                carId: wasteMove.carId,
                direction: wasteMove.direction
            };
        }

        // If no GOOD or WASTE moves, return the first BLUNDER move
        // (this should rarely happen in a valid game state)
        const firstMove = movesWithQuality[0];
        return {
            carId: firstMove.carId,
            direction: firstMove.direction
        };
    }

    private determineMove(currentState: number[][], newState: number[][]): {
        carId: number;
        direction: MovementDirection;
    } {
        // Compare the two states to determine which car moved and in what direction
        for (let i = 0; i < currentState.length; i++) {
            for (let j = 0; j < currentState[i].length; j++) {
                if (currentState[i][j] !== newState[i][j]) {
                    const carId = currentState[i][j] !== 0 ? currentState[i][j] : newState[i][j];

                    // Find where the car moved to determine direction
                    const currentPositions = this.findCarPositions(currentState, carId);
                    const newPositions = this.findCarPositions(newState, carId);

                    const direction = this.getMovementDirection(currentPositions, newPositions);

                    return { carId, direction };
                }
            }
        }

        throw new Error('No move detected between states');
    }

    private findCarPositions(state: number[][], carId: number): { row: number; col: number }[] {
        const positions: { row: number; col: number }[] = [];

        for (let i = 0; i < state.length; i++) {
            for (let j = 0; j < state[i].length; j++) {
                if (state[i][j] === carId) {
                    positions.push({ row: i, col: j });
                }
            }
        }

        return positions;
    }

    private getMovementDirection(
        oldPositions: { row: number; col: number }[],
        newPositions: { row: number; col: number }[]
    ): MovementDirection {
        const oldCenter = this.calculateCenter(oldPositions);
        const newCenter = this.calculateCenter(newPositions);

        if (newCenter.row < oldCenter.row) return MovementDirection.Up;
        if (newCenter.row > oldCenter.row) return MovementDirection.Down;
        if (newCenter.col < oldCenter.col) return MovementDirection.Left;
        if (newCenter.col > oldCenter.col) return MovementDirection.Right;

        throw new Error('Unable to determine movement direction');
    }

    private calculateCenter(positions: { row: number; col: number }[]): { row: number; col: number } {
        const sum = positions.reduce(
            (acc, pos) => ({ row: acc.row + pos.row, col: acc.col + pos.col }),
            { row: 0, col: 0 }
        );

        return {
            row: sum.row / positions.length,
            col: sum.col / positions.length
        };
    }

    async getSolution(gameId: string): Promise<Step[]> {
        const game = await this.getGame(gameId);
        const solution = await this.calculateSolutionPath(game.currentState);

        await this.abandonGame(gameId);

        return solution;
    }

    private async calculateSolutionPath(state: number[][]): Promise<Step[]> {
        const visited = new Map<string, {
            previousState: number[][] | null;
            move: Step | null
        }>();
        const queue = new PriorityQueue();
        const initialState: State = { matrix: state, moves: 0 };

        this.initializeSearch(initialState, queue, visited);
        const finalState = await this.findSolution(queue, visited);
        return this.reconstructPath(finalState, visited);
    }

    private initializeSearch(
        initialState: State,
        queue: PriorityQueue,
        visited: Map<string, { previousState: number[][] | null; move: Step | null }>
    ): void {
        queue.enqueue(initialState, this.calculateEnhancedHeuristic(initialState.matrix));
        visited.set(this.getStateKey(initialState.matrix), { previousState: null, move: null });
    }

    private async findSolution(
        queue: PriorityQueue,
        visited: Map<string, { previousState: number[][] | null; move: Step | null }>
    ): Promise<number[][]> {
        while (queue.length > 0) {
            if (visited.size > this.MAX_SEARCH_STATES) {
                throw new Error('Search space exceeded maximum allowed states');
            }

            const currentState = queue.dequeue();
            if (!currentState) continue;

            if (this.checkWinCondition(currentState.matrix)) {
                return currentState.matrix;
            }

            await this.processNextMoves(currentState, queue, visited);
        }

        throw new Error('No solution found');
    }

    private async processNextMoves(
        currentState: State,
        queue: PriorityQueue,
        visited: Map<string, { previousState: number[][] | null; move: Step | null }>
    ): Promise<void> {
        const nextMoves = await this.generateNextMoves(currentState);

        for (const nextState of nextMoves) {
            const nextStateKey = this.getStateKey(nextState.matrix);
            if (!visited.has(nextStateKey)) {
                this.addNewState(currentState, nextState, nextStateKey, queue, visited);
            }
        }
    }

    private addNewState(
        currentState: State,
        nextState: State,
        nextStateKey: string,
        queue: PriorityQueue,
        visited: Map<string, { previousState: number[][] | null; move: Step | null }>
    ): void {
        const move = this.determineMove(currentState.matrix, nextState.matrix);
        visited.set(nextStateKey, {
            previousState: currentState.matrix,
            move: move
        });

        const priority = nextState.moves + this.calculateEnhancedHeuristic(nextState.matrix);
        queue.enqueue(nextState, priority);
    }

    private reconstructPath(
        finalState: number[][],
        visited: Map<string, { previousState: number[][] | null; move: Step | null }>
    ): Step[] {
        const solution: Step[] = [];
        let currentState = finalState;

        while (currentState !== null) {
            const visitedInfo = visited.get(this.getStateKey(currentState));
            if (!visitedInfo) break;

            if (visitedInfo.move) {
                solution.unshift(visitedInfo.move);
            }

            if (visitedInfo.previousState === null) break;
            currentState = visitedInfo.previousState;
        }
        return solution;
    }

    async getAnalysis(gameId: string): Promise<AnalysisResult> {
        const analysis = await this.redisService.getAnalysisResult(gameId);

        if (!analysis) {
            throw new Error('Analysis not found');
        }

        return analysis;
    }

    async createAnalysis(gameId: string): Promise<void> {
        // Publish event for move quality calculation
        await this.rabbitMQService.publishMoveEvent({
            type: 'CREATE_ANALYSIS',
            gameId: gameId,
        });
    }

    async createAnalysisFromWorker(gameId: string): Promise<{
        totalMoves: number;
        goodMoves: number;
        wasteMoves: number;
        blunders: number;
        efficiency: number;
        timeSpent: number;
    }> {
        const game = await this.getGame(gameId);

        const analysis = {
            totalMoves: game.moves.length,
            goodMoves: game.moves.filter(move => move.moveQuality === MoveQuality.GOOD).length,
            wasteMoves: game.moves.filter(move => move.moveQuality === MoveQuality.WASTE).length,
            blunders: game.moves.filter(move => move.moveQuality === MoveQuality.BLUNDER).length,
            efficiency: (game.minimumMovesRequired / game.moves.length) * 100,
            timeSpent: this.calculateTimeSpent(game.moves)
        };

        // Save analysis to redis
        await this.redisService.saveAnalysisResult(gameId, analysis);

        return analysis;
    }

    async abandonGame(gameId: string): Promise<void> {
        const game = await this.getGame(gameId);

        if (game.isSolved) {
            throw new Error('Cannot abandon already solved game');
        }

        game.lastMoveAt = new Date();
        await this.updateGame(gameId, game);
    }

    async getLeaderboard(timeFrame: string): Promise<{
        gameId: string;
        boardId: string;
        moves: number;
        efficiency: number;
        timeSpent: number;
        completedAt: Date;
    }[]> {
        const startDate = this.getTimeFrameDate(timeFrame);

        const games = await this.gameModel.find({
            isSolved: true,
            lastMoveAt: { $gte: startDate }
        }).exec();

        const leaderboardEntries = games.map(game => ({
            gameId: game.id,
            boardId: game.boardId,
            moves: game.moves.length,
            efficiency: (game.minimumMovesRequired / game.moves.length) * 100,
            timeSpent: this.calculateTimeSpent(game.moves),
            completedAt: game.lastMoveAt
        }));

        return leaderboardEntries.sort((a, b) => {
            if (a.efficiency !== b.efficiency) return b.efficiency - a.efficiency;
            if (a.moves !== b.moves) return a.moves - b.moves;
            return a.timeSpent - b.timeSpent;
        });
    }

    async moveCar(gameId: string, moveCarDto: MoveCarDto): Promise<Game> {
        const game = await this.getGame(gameId);
        if (!game) {
            throw new NotFoundException('Game not found');
        }

        // Check if game has been inactive for at least five minutes
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        if (game.lastMoveAt <= fiveMinutesAgo) {
            throw new BadRequestException('Game has been inactive for too long');
        }

        // Publish event for move quality calculation
        await this.rabbitMQService.publishMoveEvent({
            type: 'CALC_MOVE',
            gameId: gameId,
            move: moveCarDto,
        });


        return game;
    }

    async getMoveCarResult(gameId: string) {
        const game = await this.getGame(gameId);
        if (!game) {
            throw new NotFoundException('Game not found');
        }

        if (game.moves.length === 0) {
            throw new NotFoundException('No moves found');
        }

        // Return the last move
        return game.moves[game.moves.length - 1];
    }

    async calcMoveQuality(gameId: string, moveCarDto: MoveCarDto) {
        // Find the game by ID
        const game = await this.getGame(gameId);
        if (!game) {
            throw new NotFoundException('Game not found');
        }

        if (game.isSolved) {
            throw new BadRequestException('Game is already solved');
        }

        const { carId, direction } = moveCarDto;

        // Validate if the car exists in current state
        if (!this.isCarPresent(game.currentState, carId)) {
            throw new BadRequestException(`Car with ID ${carId} not found on board`);
        }

        // Calculate and validate the move
        const newState = this.calculateNewState(game.currentState, carId, direction);
        if (!newState) {
            throw new BadRequestException('Invalid move: path is blocked or out of bounds');
        }

        // Calculate move quality and minimum moves after this move
        const moveQuality = await this.calculateMoveQuality(newState, game.minimumMovesRequired, gameId);
        const minimumMovesAfter = await this.calculateMinimumMoves(newState, gameId);

        // Create new game move
        const gameMove: GameMove = {
            carId,
            direction,
            moveQuality,
            minimumMovesAfter,
            timestamp: new Date()
        };

        // Check if the game is solved with this move
        const isSolved = this.checkWinCondition(newState);

        // Update game state
        const updatedGame = Object.assign(game, {
            currentState: newState,
            moves: [...game.moves, gameMove],
            lastMoveAt: new Date(),
            isSolved,
            minimumMovesRequired: minimumMovesAfter
        });

        try {

            //Save or update redis and return
            await this.updateGame(gameId, updatedGame);

            return updatedGame as Game;

        } catch (error: unknown) {
            // Handle Redis errors or other issues gracefully
            if (error instanceof Error) {
                console.error('Redis error:', error.message);
                throw new Error('An error occurred while processing the game move');
            } else {
                throw new Error('An error occurred while processing the game move');
            }
        }
    }

    private isCarPresent(matrix: number[][], carId: number): boolean {
        return matrix.some(row => row.includes(carId));
    }

    private calculateNewState(
        currentState: number[][],
        carId: number,
        direction: MovementDirection
    ): number[][] | null {
        const newState = currentState.map(row => [...row]);
        const carPosition = this.findCarPosition(currentState, carId);

        if (!carPosition) return null;

        const { orientation, positions } = carPosition;

        // Validate move direction against car orientation
        if (
            (orientation === 'horizontal' && (direction === MovementDirection.Up || direction === MovementDirection.Down)) ||
            (orientation === 'vertical' && (direction === MovementDirection.Left || direction === MovementDirection.Right))
        ) {
            return null;
        }

        // Calculate new positions
        const newPositions = positions.map(pos => {
            const newPos = { row: pos.row, col: pos.col };
            switch (direction) {
                case MovementDirection.Up:
                    newPos.row--;
                    break;
                case MovementDirection.Down:
                    newPos.row++;
                    break;
                case MovementDirection.Left:
                    newPos.col--;
                    break;
                case MovementDirection.Right:
                    newPos.col++;
                    break;
            }
            return newPos;
        });

        // Validate new positions
        if (!this.arePositionsValid(newPositions, currentState, carId)) {
            return null;
        }

        // Clear old positions
        positions.forEach(pos => {
            newState[pos.row][pos.col] = 0;
        });

        // Set new positions
        newPositions.forEach(pos => {
            newState[pos.row][pos.col] = carId;
        });

        return newState;
    }

    private findCarPosition(matrix: number[][], carId: number) {
        const positions: { row: number; col: number }[] = [];

        for (let row = 0; row < matrix.length; row++) {
            for (let col = 0; col < matrix[row].length; col++) {
                if (matrix[row][col] === carId) {
                    positions.push({ row, col });
                }
            }
        }

        if (positions.length === 0) return null;

        // Determine orientation
        const orientation = positions[0].row === positions[1].row ? 'horizontal' : 'vertical';

        return { orientation, positions };
    }

    private arePositionsValid(
        positions: { row: number; col: number }[],
        matrix: number[][],
        carId: number
    ): boolean {
        return positions.every(pos =>
            pos.row >= 0 &&
            pos.row < matrix.length &&
            pos.col >= 0 &&
            pos.col < matrix[0].length &&
            (matrix[pos.row][pos.col] === 0 || matrix[pos.row][pos.col] === carId)
        );
    }

    private checkWinCondition(matrix: number[][]): boolean {
        // Assuming car ID 1 is the red car and needs to reach the right edge
        const lastColumn = matrix[0].length - 1;
        return matrix.some(row => row[lastColumn] === 1);
    }

    private async calculateMoveQuality(
        newState: number[][],
        currentMinimumMoves: number,
        gameid: string
    ): Promise<MoveQuality> {
        const newMinimumMoves = await this.calculateMinimumMoves(newState, gameid);

        if (newMinimumMoves < currentMinimumMoves) {
            return MoveQuality.GOOD;
        } else if (newMinimumMoves === currentMinimumMoves) {
            return MoveQuality.WASTE;
        } else {
            return MoveQuality.BLUNDER;
        }
    }

    async calculateMinimumMoves(state: number[][], gameId: string): Promise<number> {
        // Validate board size
        if (state.length > this.MAX_BOARD_SIZE || state[0].length > this.MAX_BOARD_SIZE) {
            throw new BadRequestException('Board size exceeds maximum allowed dimensions');
        }

        const stateKey = this.getStateKey(state);
        const redisKey = `${gameId}:${stateKey}`; // Combine gameId and stateKey

        try {

            // Check Redis cache first
            const cachedValue = await this.redisService.get(redisKey);
            if (cachedValue !== null) {
                return Number(cachedValue);
            }

            const queue = new PriorityQueue();
            const visited = new Set<string>();
            const initialState: State = {
                matrix: state,
                moves: 0
            };

            queue.enqueue(initialState, this.calculateEnhancedHeuristic(state));
            visited.add(stateKey);

            const processStateChunk = async (states: State[]): Promise<number | null> => {
                for (const currentState of states) {
                    if (this.checkWinCondition(currentState.matrix)) {
                        return currentState.moves;
                    }

                    const nextMoves = await this.generateNextMoves(currentState);
                    for (const nextState of nextMoves) {
                        const nextStateKey = this.getStateKey(nextState.matrix);
                        if (!visited.has(nextStateKey)) {
                            visited.add(nextStateKey);
                            const priority = nextState.moves +
                                this.calculateEnhancedHeuristic(nextState.matrix);
                            queue.enqueue(nextState, priority);
                        }
                    }
                }
                return null;
            };

            while (queue.length > 0) {
                if (visited.size > this.MAX_SEARCH_STATES) {
                    console.warn('Search space exceeded maximum allowed states');
                    return Infinity;
                }

                // Process states in parallel chunks
                const stateChunks: State[][] = [];
                for (let i = 0; i < this.PARALLEL_CHUNK_SIZE && queue.length > 0; i++) {
                    const state = queue.dequeue();
                    if (state) {
                        stateChunks.push([state]);
                    }
                }

                const results = await Promise.all(
                    stateChunks.map(chunk => processStateChunk(chunk))
                );

                const solution = results.find(result => result !== null);
                if (solution !== undefined && solution !== null) {
                    // Cache the result
                    this.redisService.set(redisKey, solution);
                    return solution;
                }
            }

            return Infinity;

        } catch (error: unknown) {
            // Handle Redis errors or other issues gracefully
            if (error instanceof Error) {
                console.error('Redis error:', error.message);
                throw new Error('An error occurred while processing the game state');
            } else {
                throw new Error('An error occurred while processing the game state');
            }

        }
    }

    private calculateEnhancedHeuristic(matrix: number[][]): number {
        const redCarRow = matrix.findIndex(row => row.includes(1));
        if (redCarRow === -1) return Infinity;

        const redCarRightmost = matrix[redCarRow].lastIndexOf(1);
        const redCarLeftmost = matrix[redCarRow].indexOf(1);

        let heuristic = 0;

        // 1. Direct blocking vehicles
        const directBlockingCars = new Set<number>();
        for (let col = redCarRightmost + 1; col < matrix[0].length; col++) {
            if (matrix[redCarRow][col] !== 0) {
                directBlockingCars.add(matrix[redCarRow][col]);
            }
        }
        heuristic += directBlockingCars.size * 2;

        // 2. Indirect blocking vehicles (cars blocking the movement of direct blockers)
        for (const blockerId of directBlockingCars) {
            const blockerPositions = this.findCarPosition(matrix, blockerId);
            if (blockerPositions) {
                const { orientation, positions } = blockerPositions;
                if (orientation === 'vertical') {
                    // Check for cars blocking the vertical movement
                    heuristic += this.countBlockingCarsForVerticalMove(matrix, positions);
                }
            }
        }

        // 3. Distance to exit
        const distanceToExit = matrix[0].length - redCarRightmost - 1;
        heuristic += distanceToExit;

        // 4. Red car mobility factor
        const redCarMobility = this.calculateRedCarMobility(matrix, redCarRow, redCarLeftmost, redCarRightmost);
        heuristic += redCarMobility;

        // 5. Congestion factor
        const congestionFactor = this.calculateCongestionFactor(matrix, redCarRow);
        heuristic += congestionFactor;

        return heuristic;
    }

    private calculateRedCarMobility(
        matrix: number[][],
        redCarRow: number,
        leftmost: number,
        rightmost: number
    ): number {
        let mobilityPenalty = 0;

        // Check spaces to the left of the red car
        for (let col = leftmost - 1; col >= 0; col--) {
            if (matrix[redCarRow][col] !== 0) {
                mobilityPenalty += 1;
            }
        }

        // Check if the red car is trapped (blocked on both sides)
        const isTrappedLeft = leftmost > 0 && matrix[redCarRow][leftmost - 1] !== 0;
        const isTrappedRight = rightmost < matrix[0].length - 1 && matrix[redCarRow][rightmost + 1] !== 0;

        if (isTrappedLeft && isTrappedRight) {
            mobilityPenalty += 3; // Higher penalty for being completely trapped
        }

        // Penalty for being far from the exit if blocked
        if (rightmost < matrix[0].length - 2) { // If not adjacent to exit
            const distanceFromExit = matrix[0].length - rightmost - 1;
            mobilityPenalty += Math.floor(distanceFromExit / 2);
        }

        return mobilityPenalty;
    }

    private countBlockingCarsForVerticalMove(
        matrix: number[][],
        positions: { row: number; col: number }[]
    ): number {
        const blockedPositions = new Set<number>();

        positions.forEach(pos => {
            // Check above and below the car
            [-1, 1].forEach(direction => {
                const newRow = pos.row + direction;
                if (newRow >= 0 && newRow < matrix.length &&
                    matrix[newRow][pos.col] !== 0) {
                    blockedPositions.add(matrix[newRow][pos.col]);
                }
            });
        });

        return blockedPositions.size;
    }

    private calculateCongestionFactor(matrix: number[][], redCarRow: number): number {
        let congestion = 0;
        const rowsToCheck = [redCarRow - 1, redCarRow, redCarRow + 1];

        rowsToCheck.forEach(row => {
            if (row >= 0 && row < matrix.length) {
                const occupiedSpaces = matrix[row].filter(cell => cell !== 0).length;
                congestion += occupiedSpaces / matrix[row].length;
            }
        });

        return Math.round(congestion * 2);
    }

    private async generateNextMoves(state: State): Promise<State[]> {
        const nextStates: State[] = [];
        const cars = new Set<number>();

        state.matrix.forEach(row => {
            row.forEach(cell => {
                if (cell !== 0) cars.add(cell);
            });
        });

        for (const carId of cars) {
            // Avoid moving the same car back and forth
            if (state.lastMove?.carId === carId) {
                continue;
            }

            for (const direction of Object.values(MovementDirection)) {
                // Avoid immediate reverse moves
                if (state.lastMove?.carId === carId &&
                    this.isOppositeDirection(state.lastMove.direction, direction)) {
                    continue;
                }

                const newMatrix = this.calculateNewState(state.matrix, carId, direction);
                if (newMatrix) {
                    nextStates.push({
                        matrix: newMatrix,
                        moves: state.moves + 1,
                        lastMove: { carId, direction }
                    });
                }
            }
        }

        return nextStates;
    }

    private isOppositeDirection(
        dir1: MovementDirection,
        dir2: MovementDirection
    ): boolean {
        return (
            (dir1 === MovementDirection.Up && dir2 === MovementDirection.Down) ||
            (dir1 === MovementDirection.Down && dir2 === MovementDirection.Up) ||
            (dir1 === MovementDirection.Left && dir2 === MovementDirection.Right) ||
            (dir1 === MovementDirection.Right && dir2 === MovementDirection.Left)
        );
    }

    private getStateKey(matrix: number[][]): string {
        return matrix.map(row => row.join(',')).join(';');
    }

    private calculateTimeSpent(moves: GameMove[]): number {
        if (moves.length === 0) return 0;
        return moves[moves.length - 1].timestamp.getTime() - moves[0].timestamp.getTime();
    }

    private getTimeFrameDate(timeFrame: string): Date {
        const now = new Date();
        switch (timeFrame) {
            case 'daily':
                return new Date(now.setHours(0, 0, 0, 0));
            case 'weekly':
                return new Date(now.setDate(now.getDate() - now.getDay()));
            case 'monthly':
                return new Date(now.setDate(1));
            case 'allTime':
                return new Date(0);
            default:
                return new Date(now.setDate(now.getDate() - 7));
        }
    }

    private async getBoardDifficulty(board: Board): Promise<string> {
        // Implement difficulty calculation based on board complexity
        const complexity = await this.calculateBoardComplexity(board);
        if (complexity < 10) return 'easy';
        if (complexity < 20) return 'medium';
        return 'hard';
    }

    private async calculateBoardComplexity(board: Board): Promise<number> {
        // Constants for weighting different factors
        const CAR_COUNT_WEIGHT = 0.3;
        const BLOCKING_CARS_WEIGHT = 0.35;
        const EXIT_DISTANCE_WEIGHT = 0.2;
        const CONGESTION_WEIGHT = 0.15;

        try {
            const matrix = board.matrix;

            // Validate board size
            if (matrix.length > this.MAX_BOARD_SIZE || matrix[0].length > this.MAX_BOARD_SIZE) {
                throw new Error(`Board size exceeds maximum allowed dimensions of ${this.MAX_BOARD_SIZE}x${this.MAX_BOARD_SIZE}`);
            }

            // Calculate state space size estimation
            const stateSpaceEstimate = this.estimateStateSpaceSize(matrix);
            if (stateSpaceEstimate > this.MAX_SEARCH_STATES) {
                // If estimated state space is too large, consider it maximum difficulty
                return 100;
            }

            // 1. Count number of cars and create a map of car positions
            const carPositions = new Map<number, {
                positions: [number, number][],
                orientation: 'horizontal' | 'vertical',
                movementRange: number
            }>();
            let carCount = 0;

            for (let i = 0; i < matrix.length; i++) {
                for (let j = 0; j < matrix[i].length; j++) {
                    const cell = matrix[i][j];
                    if (cell > 0) {
                        if (!carPositions.has(cell)) {
                            carCount++;
                            carPositions.set(cell, {
                                positions: [],
                                orientation: 'horizontal',
                                movementRange: 0
                            });
                        }
                        carPositions.get(cell)?.positions.push([i, j]);
                    }
                }
            }

            // Process in chunks if there are many cars
            const processInChunks = carCount > this.PARALLEL_CHUNK_SIZE;

            // 2. Determine car orientations and movement ranges
            if (processInChunks) {
                const chunks = this.chunkArray(Array.from(carPositions.entries()), this.PARALLEL_CHUNK_SIZE);
                await Promise.all(chunks.map(chunk =>
                    this.processCarChunk(chunk, matrix)
                ));
            } else {
                carPositions.forEach((car, id) => {
                    car.orientation = car.positions[0][0] === car.positions[1][0] ? 'horizontal' : 'vertical';
                    car.movementRange = this.calculateCarMovementRange(car, matrix);
                });
            }

            const targetCar = carPositions.get(1);
            if (!targetCar) {
                throw new Error('Target car not found');
            }

            // 3. Calculate blocking factors
            const blockingFactors = this.calculateBlockingFactors(targetCar, matrix, carPositions);

            // 4. Calculate exit distance (normalized)
            const targetLastCol = Math.max(...targetCar.positions.map(pos => pos[1]));
            const exitDistance = (matrix.length - 1 - targetLastCol) / matrix.length;

            // 5. Calculate congestion score
            const congestionScore = this.calculateCongestionScore(matrix, carPositions);

            // 6. Calculate movement restriction score
            const movementRestrictionScore = this.calculateMovementRestrictionScore(carPositions, matrix);

            // Calculate final complexity score (0-100 scale)
            const complexityScore = Math.round(
                (carCount / this.MAX_BOARD_SIZE * CAR_COUNT_WEIGHT +
                    blockingFactors.normalizedScore * BLOCKING_CARS_WEIGHT +
                    exitDistance * EXIT_DISTANCE_WEIGHT +
                    congestionScore * CONGESTION_WEIGHT +
                    movementRestrictionScore * 0.5) * 100
            );

            return Math.min(Math.max(complexityScore, 0), 100);

        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error('Error calculating board complexity:', error);
            } else {
                console.error('Error calculating board complexity: Unknown error');
            }
            return 50; // Return medium difficulty if calculation fails
        }
    }

    private estimateStateSpaceSize(matrix: number[][]): number {
        const cars = new Set<number>();
        matrix.forEach(row => row.forEach(cell => {
            if (cell > 0) cars.add(cell);
        }));

        // Rough estimate: each car can move in 4 directions with average of 3 possible positions
        return Math.pow(12, cars.size);
    }

    private async processCarChunk(
        chunk: [number, Car][],
        matrix: number[][]
    ): Promise<void> {
        chunk.forEach(([id, car]) => {
            car.orientation = car.positions[0][0] === car.positions[1][0] ? 'horizontal' : 'vertical';
            car.movementRange = this.calculateCarMovementRange(car, matrix);
        });
    }

    private calculateCarMovementRange(
        car: Car,
        matrix: number[][]
    ): number {
        return car.orientation === 'horizontal'
            ? this.calculateHorizontalMovementRange(car, matrix)
            : this.calculateVerticalMovementRange(car, matrix);
    }

    private calculateHorizontalMovementRange(
        car: Car,
        matrix: number[][]
    ): number {
        const row = car.positions[0][0];
        const [minCol, maxCol] = this.getColumnBoundaries(car.positions);

        const leftRange = this.calculateLeftRange(row, minCol, matrix);
        const rightRange = this.calculateRightRange(row, maxCol, matrix);

        return leftRange + rightRange;
    }

    private calculateVerticalMovementRange(
        car: Car,
        matrix: number[][]
    ): number {
        const col = car.positions[0][1];
        const [minRow, maxRow] = this.getRowBoundaries(car.positions);

        const upwardRange = this.calculateUpwardRange(col, minRow, matrix);
        const downwardRange = this.calculateDownwardRange(col, maxRow, matrix);

        return upwardRange + downwardRange;
    }

    private getColumnBoundaries(positions: Position[]): [number, number] {
        const cols = positions.map((pos: Position): number => pos[1]);
        return [Math.min(...cols), Math.max(...cols)];
    }

    private getRowBoundaries(positions: Position[]): [number, number] {
        const rows = positions.map((pos: Position): number => pos[0]);
        return [Math.min(...rows), Math.max(...rows)];
    }

    private calculateLeftRange(row: number, minCol: number, matrix: number[][]): number {
        let range = 0;
        for (let col = minCol - 1; col >= 0 && matrix[row][col] === 0; col--) {
            range++;
        }
        return range;
    }

    private calculateRightRange(row: number, maxCol: number, matrix: number[][]): number {
        let range = 0;
        for (let col = maxCol + 1; col < matrix[0].length && matrix[row][col] === 0; col++) {
            range++;
        }
        return range;
    }

    private calculateUpwardRange(col: number, minRow: number, matrix: number[][]): number {
        let range = 0;
        for (let row = minRow - 1; row >= 0 && matrix[row][col] === 0; row--) {
            range++;
        }
        return range;
    }

    private calculateDownwardRange(col: number, maxRow: number, matrix: number[][]): number {
        let range = 0;
        for (let row = maxRow + 1; row < matrix.length && matrix[row][col] === 0; row++) {
            range++;
        }
        return range;
    }


    private calculateBlockingFactors(
        targetCar: { positions: [number, number][]; orientation: string },
        matrix: number[][],
        carPositions: Map<number, any>
    ): { normalizedScore: number; directBlocking: number } {
        let directBlocking = 0;
        let indirectBlocking = 0;
        const targetRow = targetCar.positions[0][0];
        const targetLastCol = Math.max(...targetCar.positions.map(pos => pos[1]));

        // Count direct blocking cars
        for (let col = targetLastCol + 1; col < matrix[0].length; col++) {
            if (matrix[targetRow][col] > 0) {
                directBlocking++;
                // Check if blocking cars are themselves blocked
                const blockingCarId = matrix[targetRow][col];
                const blockingCar = carPositions.get(blockingCarId);
                if (blockingCar && this.isCarBlocked(blockingCar, matrix)) {
                    indirectBlocking++;
                }
            }
        }

        // Normalize the blocking score
        const maxPossibleBlocking = matrix[0].length - targetLastCol - 1;
        const normalizedScore = (directBlocking + (indirectBlocking * 0.5)) / maxPossibleBlocking;

        return { normalizedScore, directBlocking };
    }

    private calculateCongestionScore(
        matrix: number[][],
        carPositions: Map<number, any>
    ): number {
        const totalCells = matrix.length * matrix[0].length;
        const occupiedCells = Array.from(carPositions.values())
            .reduce((sum, car) => sum + car.positions.length, 0);

        return occupiedCells / totalCells;
    }

    private calculateMovementRestrictionScore(
        carPositions: Map<number, any>,
        matrix: number[][]
    ): number {
        let totalRestriction = 0;
        const maxRestriction = carPositions.size * 4; // Maximum 4 directions per car

        carPositions.forEach((car) => {
            const restrictedDirections = 4 - this.getAvailableDirections(car, matrix).length;
            totalRestriction += restrictedDirections;
        });

        return totalRestriction / maxRestriction;
    }

    private getAvailableDirections(car: Car, matrix: number[][]): MovementDirection[] {
        const directions: MovementDirection[] = [];
        const isHorizontal = car.orientation === 'horizontal';

        if (isHorizontal) {
            if (this.canMoveLeft(car, matrix)) directions.push(MovementDirection.Left);
            if (this.canMoveRight(car, matrix)) directions.push(MovementDirection.Right);
        } else {
            if (this.canMoveUp(car, matrix)) directions.push(MovementDirection.Up);
            if (this.canMoveDown(car, matrix)) directions.push(MovementDirection.Down);
        }

        return directions;
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    private isCarBlocked(car: Car, matrix: number[][]): boolean {
        return this.getAvailableDirections(car, matrix).length === 0;
    }

    private canMoveLeft(car: Car, matrix: number[][]): boolean {
        const row = car.positions[0][0];
        const minCol = Math.min(...car.positions.map((pos: Position): number => pos[1]));
        return minCol > 0 && matrix[row][minCol - 1] === 0;
    }

    private canMoveRight(car: Car, matrix: number[][]): boolean {
        const row = car.positions[0][0];
        const maxCol = Math.max(...car.positions.map((pos: Position): number => pos[1]));
        return maxCol < matrix[0].length - 1 && matrix[row][maxCol + 1] === 0;
    }

    private canMoveUp(car: Car, matrix: number[][]): boolean {
        const col = car.positions[0][1];
        const minRow = Math.min(...car.positions.map((pos: Position): number => pos[0]));
        return minRow > 0 && matrix[minRow - 1][col] === 0;
    }

    private canMoveDown(car: Car, matrix: number[][]): boolean {
        const col = car.positions[0][1];
        const maxRow = Math.max(...car.positions.map((pos: Position): number => pos[0]));
        return maxRow < matrix.length - 1 && matrix[maxRow + 1][col] === 0;
    }

}

