import { DeleteResult } from 'mongoose';
import { Game } from '../schemas/game.schema';
import { IBaseRepository } from './repository.interface';

export interface GameFilterCriteria {
    isSolved: boolean;
    lastMoveAt: Date | { $gte: Date } | { $lte: Date };
}

export interface IGameRepository extends IBaseRepository<Game> {
    findByBoardId(boardId: string): Promise<Game[]>;
    findUnfinishedGames(): Promise<Game[]>;
    findByIsSolvedAndLastMove(criteria: GameFilterCriteria): Promise<Game[]>;
    findByLastMove(criteria: GameFilterCriteria): Promise<Game[]>;
    deleteByLastMove(criteria: GameFilterCriteria): Promise<DeleteResult>;
}