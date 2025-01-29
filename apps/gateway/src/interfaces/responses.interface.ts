// apps/gateway/src/interfaces/responses.interface.ts
import { ApiProperty } from '@nestjs/swagger';
import { MovementDirection, MoveQuality } from '../../../../shared/src/interfaces/rush-hour.interface';

export class BoardResponse {
    @ApiProperty()
    id: string;

    @ApiProperty({
        description: 'The game board matrix',
        example: [
            [0, 1, 1, 0, 0, 0],
            [0, 0, 0, 2, 0, 0],
            [0, 3, 3, 2, 0, 0],
            [0, 0, 0, 2, 0, 0],
            [0, 4, 4, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
        ],
    })
    matrix: number[][];

    @ApiProperty({
        enum: ['easy', 'medium', 'hard'],
        example: 'medium',
    })
    difficulty: string;

    @ApiProperty({
        description: 'Minimum number of moves required to solve',
        example: 15,
    })
    minimumMoves: number;

    @ApiProperty()
    createdAt: Date;
}

export class GameMove {
    @ApiProperty({
        description: 'ID of the car being moved',
        example: 1,
    })
    carId: number;

    @ApiProperty({
        enum: MovementDirection,
        example: MovementDirection.Right,
    })
    direction: MovementDirection;

    @ApiProperty({
        enum: MoveQuality,
        example: MoveQuality.GOOD,
    })
    moveQuality: MoveQuality;

    @ApiProperty({
        description: 'Minimum moves required after this move',
        example: 12,
    })
    minimumMovesAfter: number;

    @ApiProperty()
    timestamp: Date;
}

export class GameResponse {
    @ApiProperty()
    id: string;

    @ApiProperty()
    boardId: string;

    @ApiProperty({
        description: 'Current state of the game board',
        type: 'array',
    })
    currentState: number[][];

    @ApiProperty({
        type: [GameMove],
        description: 'History of moves made in the game',
    })
    moves: GameMove[];

    @ApiProperty({
        description: 'Whether the puzzle has been solved',
        example: false,
    })
    isSolved: boolean;

    @ApiProperty({
        description: 'Minimum moves required to solve from current state',
        example: 12,
    })
    minimumMovesRequired: number;

    @ApiProperty()
    lastMoveAt: Date;

    @ApiProperty()
    createdAt: Date;
}

