import { Injectable } from '@nestjs/common';

@Injectable()
export class MoveAnalysisService {
    async analyzeMoveQuality(
        _gameId: string,
        currentState: number[][],
        previousMinMoves: number,
    ) {
        // Implement move analysis logic
        const newMinMoves = await this.calculateMinimumMoves(currentState);

        if (newMinMoves < previousMinMoves) {
            return 'GOOD';
        } else if (newMinMoves === previousMinMoves) {
            return 'WASTE';
        }
        return 'BLUNDER';
    }

    private async calculateMinimumMoves(board: number[][]): Promise<number> {
        return this.performBreadthFirstSearch(board);
    }

    private performBreadthFirstSearch(board: number[][]): number {
        const visited = new Set<string>();
        const queue: [number[][], number][] = [[board, 0]];
        visited.add(this.boardToString(board));

        while (queue.length > 0) {
            const [currentBoard, moves] = queue.shift();

            if (this.isSolved(currentBoard)) {
                return moves;
            }

            this.processAllCarsInBoard(currentBoard, moves, queue, visited);
        }

        return -1;
    }

    private processAllCarsInBoard(
        board: number[][],
        moves: number,
        queue: [number[][], number][],
        visited: Set<string>
    ): void {
        for (let i = 0; i < board.length; i++) {
            for (let j = 0; j < board[0].length; j++) {
                if (this.isCarStart(board, i, j)) {
                    this.processCarMoves(board, i, j, moves, queue, visited);
                }
            }
        }
    }

    private isCarStart(board: number[][], i: number, j: number): boolean {
        const car = board[i][j];
        return car !== 0 &&
            (j === 0 || board[i][j - 1] !== car) &&
            (i === 0 || board[i - 1][j] !== car);
    }

    private processCarMoves(
        board: number[][],
        x: number,
        y: number,
        moves: number,
        queue: [number[][], number][],
        visited: Set<string>
    ): void {
        const possibleMoves = this.getPossibleMoves(board, x, y);

        for (const newBoard of possibleMoves) {
            const boardStr = this.boardToString(newBoard);
            if (!visited.has(boardStr)) {
                visited.add(boardStr);
                queue.push([newBoard, moves + 1]);
            }
        }
    }

    private getPossibleMoves(board: number[][], x: number, y: number): number[][][] {
        const car = board[x][y];
        const isHorizontal = x + 1 < board.length && board[x + 1][y] === car;

        return isHorizontal ?
            this.getHorizontalMoves(board, x, y, car) :
            this.getVerticalMoves(board, x, y, car);
    }

    private getHorizontalMoves(board: number[][], x: number, y: number, car: number): number[][][] {
        const moves: number[][][] = [];
        const length = this.getCarLength(board, x, y, true);

        this.tryHorizontalMove(board, x, y, car, length, -1, moves); // Try left
        this.tryHorizontalMove(board, x, y, car, length, 1, moves);  // Try right

        return moves;
    }

    private getVerticalMoves(board: number[][], x: number, y: number, car: number): number[][][] {
        const moves: number[][][] = [];
        const length = this.getCarLength(board, x, y, false);

        this.tryVerticalMove(board, x, y, car, length, -1, moves); // Try up
        this.tryVerticalMove(board, x, y, car, length, 1, moves);  // Try down

        return moves;
    }

    private getCarLength(board: number[][], x: number, y: number, isHorizontal: boolean): number {
        let length = 1;
        if (isHorizontal) {
            while (x + length < board.length && board[x + length][y] === board[x][y]) length++;
        } else {
            while (y + length < board[0].length && board[x][y + length] === board[x][y]) length++;
        }
        return length;
    }

    private tryHorizontalMove(
        board: number[][],
        x: number,
        y: number,
        car: number,
        length: number,
        direction: number,
        moves: number[][][]
    ): void {
        const newX = direction < 0 ? x - 1 : x + length;
        if (newX >= 0 && newX < board.length && board[newX][y] === 0) {
            const newBoard = board.map(row => [...row]);
            newBoard[direction < 0 ? x + length - 1 : x][y] = 0;
            newBoard[newX][y] = car;
            moves.push(newBoard);
        }
    }

    private tryVerticalMove(
        board: number[][],
        x: number,
        y: number,
        car: number,
        length: number,
        direction: number,
        moves: number[][][]
    ): void {
        const newY = direction < 0 ? y - 1 : y + length;
        if (newY >= 0 && newY < board[0].length && board[x][newY] === 0) {
            const newBoard = board.map(row => [...row]);
            newBoard[x][direction < 0 ? y + length - 1 : y] = 0;
            newBoard[x][newY] = car;
            moves.push(newBoard);
        }
    }

    private boardToString(board: number[][]): string {
        return board.map(row => row.join(',')).join('|');
    }

    private isSolved(board: number[][]): boolean {
        const redCarRow = board.findIndex(row => row.includes(2));
        if (redCarRow === -1) return false;

        const redCarPos = board[redCarRow].indexOf(2);
        return board[redCarRow].slice(redCarPos + 2).every(cell => cell === 0);
    }

}