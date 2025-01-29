export enum MovementDirection {
    Up = 'Up',
    Right = 'Right',
    Down = 'Down',
    Left = 'Left'
}

export interface Step {
    carId: number;
    direction: MovementDirection;
}

export interface Board {
    id: string;
    matrix: number[][];
    createdAt: Date;
}

export interface Game {
    id?: string;
    boardId: string;
    currentState: number[][];
    moves: GameMove[];
    lastMoveAt: Date;
    isSolved: boolean;
    minimumMovesRequired: number;
}

export interface GameMove {
    carId: number;
    direction: MovementDirection;
    moveQuality: MoveQuality;
    minimumMovesAfter: number;
    timestamp: Date;
}

export enum MoveQuality {
    GOOD = 'GOOD',
    WASTE = 'WASTE',
    BLUNDER = 'BLUNDER'
}

export interface AnalysisResult {
    totalMoves: number;
    goodMoves: number;
    wasteMoves: number;
    blunders: number;
    efficiency: number;
    timeSpent: number;
}