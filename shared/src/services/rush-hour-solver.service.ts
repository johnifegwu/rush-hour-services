import { Injectable } from '@nestjs/common';
import { Step, MovementDirection } from '../interfaces/rush-hour.interface';

@Injectable()
export class RushHourSolverService {
    private readonly BOARD_SIZE = 6;
    private readonly RED_CAR_ID = 1;

    solve(board: number[][]): Step[] {
        const visited = new Set<string>();
        const queue: { board: number[][], steps: Step[] }[] = [{ board, steps: [] }];

        while (queue.length > 0) {
            const { board: currentBoard, steps } = queue.shift()!;

            if (this.isSolved(currentBoard)) {
                return steps;
            }

            const boardKey = this.getBoardKey(currentBoard);
            if (visited.has(boardKey)) continue;
            visited.add(boardKey);

            const possibleMoves = this.getPossibleMoves(currentBoard);
            for (const move of possibleMoves) {
                const newBoard = this.applyMove(currentBoard, move);
                queue.push({
                    board: newBoard,
                    steps: [...steps, move],
                });
            }
        }

        return []; // No solution found
    }

    private isSolved(board: number[][]): boolean {
        // Check if red car (ID 1) can reach the right edge
        const row = 2; // Red car is always on row 2 (0-based)
        return board[row][this.BOARD_SIZE - 2] === this.RED_CAR_ID &&
            board[row][this.BOARD_SIZE - 1] === this.RED_CAR_ID;
    }

    private getPossibleMoves(board: number[][]): Step[] {
        const moves: Step[] = [];
        const cars = this.findCars(board);

        for (const [carId, positions] of cars.entries()) {
            const isHorizontal = positions[0].row === positions[1].row;
            this.addValidMovesForCar(board, carId, positions, isHorizontal, moves);
        }

        return moves;
    }

    private addValidMovesForCar(
        board: number[][],
        carId: number,
        positions: Array<{ row: number, col: number }>,
        isHorizontal: boolean,
        moves: Step[]
    ): void {
        if (isHorizontal) {
            this.addHorizontalMoves(board, carId, positions, moves);
        } else {
            this.addVerticalMoves(board, carId, positions, moves);
        }
    }

    private addHorizontalMoves(
        board: number[][],
        carId: number,
        positions: Array<{ row: number, col: number }>,
        moves: Step[]
    ): void {
        // Check left movement
        if (this.canMove(board, positions[0].row, positions[0].col - 1)) {
            moves.push({ carId, direction: MovementDirection.Left });
        }
        // Check right movement
        if (this.canMove(board, positions[positions.length - 1].row,
            positions[positions.length - 1].col + 1)) {
            moves.push({ carId, direction: MovementDirection.Right });
        }
    }

    private addVerticalMoves(
        board: number[][],
        carId: number,
        positions: Array<{ row: number, col: number }>,
        moves: Step[]
    ): void {
        // Check upward movement
        if (this.canMove(board, positions[0].row - 1, positions[0].col)) {
            moves.push({ carId, direction: MovementDirection.Up });
        }
        // Check downward movement
        if (this.canMove(board, positions[positions.length - 1].row + 1,
            positions[positions.length - 1].col)) {
            moves.push({ carId, direction: MovementDirection.Down });
        }
    }


    private findCars(board: number[][]): Map<number, Array<{ row: number, col: number }>> {
        const cars = new Map<number, Array<{ row: number, col: number }>>();

        for (let row = 0; row < this.BOARD_SIZE; row++) {
            for (let col = 0; col < this.BOARD_SIZE; col++) {
                const carId = board[row][col];
                if (carId > 0) {
                    if (!cars.has(carId)) {
                        cars.set(carId, []);
                    }
                    cars.get(carId)!.push({ row, col });
                }
            }
        }

        return cars;
    }

    private canMove(board: number[][], row: number, col: number): boolean {
        return row >= 0 && row < this.BOARD_SIZE &&
            col >= 0 && col < this.BOARD_SIZE &&
            board[row][col] === 0;
    }

    private applyMove(board: number[][], move: Step): number[][] {
        const newBoard = board.map(row => [...row]);
        const cars = this.findCars(newBoard);
        const carPositions = cars.get(move.carId)!;

        // Clear current car position
        for (const pos of carPositions) {
            newBoard[pos.row][pos.col] = 0;
        }

        // Apply move
        const newPositions = carPositions.map(pos => {
            switch (move.direction) {
                case MovementDirection.Up:
                    return { row: pos.row - 1, col: pos.col };
                case MovementDirection.Right:
                    return { row: pos.row, col: pos.col + 1 };
                case MovementDirection.Down:
                    return { row: pos.row + 1, col: pos.col };
                case MovementDirection.Left:
                    return { row: pos.row, col: pos.col - 1 };
            }
        });

        // Place car in new position
        for (const pos of newPositions) {
            newBoard[pos.row][pos.col] = move.carId;
        }

        return newBoard;
    }

    private getBoardKey(board: number[][]): string {
        return board.map(row => row.join(',')).join(';');
    }
}