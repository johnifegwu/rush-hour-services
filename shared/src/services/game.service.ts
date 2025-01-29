import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Board, Game } from '../schemas';
import { MoveCarDto } from '../dto/move-car.dto';
import { RedisService } from 'shared/src/services';
import { BadRequestException, NotFoundException } from 'shared/src/exceptions';
import { GameMove, MovementDirection, MoveQuality } from 'shared/src/interfaces/rush-hour.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

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

        if (this.heap.length > 0) {
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
    private readonly stateCache: Map<string, number> = new Map();
    private readonly MAX_BOARD_SIZE = 6; // Standard Rush Hour board size
    private readonly MAX_SEARCH_STATES = 100000;
    private readonly PARALLEL_CHUNK_SIZE = 1000;
    constructor(
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        @InjectModel(Board.name) private readonly boardModel: Model<Board>,
        @InjectModel(Game.name) private readonly gameModel: Model<Game>,
        private readonly redisService: RedisService,
    ) { }

    async createBoard(matrix: number[][]) {
        const board = new this.boardModel({ matrix });
        return board.save();
    }

    async startGame(boardId: string) {
        const board = await this.boardModel.findById(boardId);
        if (!board) throw new Error('Board not found');

        const game = new this.gameModel({
            boardId,
            currentState: board.matrix,
            moves: [],
            lastMoveAt: new Date(),
            minimumMovesRequired: 0,
        });

        return game.save();
    }

    async getGame(gameId: string) {
        return this.gameModel.findById(gameId);
    }

    async moveCar(gameId: string, moveCarDto: MoveCarDto): Promise<Game> {
        // Find the game by ID
        const game = await this.gameModel.findById(gameId);
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


        // Save and return updated game
        return await this.gameModel.findByIdAndUpdate(
            gameId,
            updatedGame,
            { new: true }
        );
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

    private async calculateMinimumMoves(state: number[][], gameId: string): Promise<number> {
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
                return cachedValue; // Return cached value if it exists
            }

            // Check cache first
            // if (this.stateCache.has(stateKey)) { //replaced with Redis implementation.
            //     return this.stateCache.get(stateKey);
            // }

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

        } catch (error) {
            // Handle Redis errors or other issues gracefully
            console.error('Redis error:', error.message);
            throw new Error('An error occurred while processing the game state');
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
}