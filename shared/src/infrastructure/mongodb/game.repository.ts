import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DeleteResult, Model } from 'mongoose';
import { Game } from '../../schemas/game.schema';
import { GameFilterCriteria, IGameRepository } from '../../interfaces/game-repository.interface';
import { BaseMongoRepository } from './base.repository';

@Injectable()
export class GameMongoRepository extends BaseMongoRepository<Game> implements IGameRepository {
    constructor(
        @InjectModel(Game.name) private gameModel: Model<Game>
    ) {
        super(gameModel);
    }

    async findByBoardId(boardId: string): Promise<Game[]> {
        return await this.gameModel.find({ boardId });
    }

    async findUnfinishedGames(): Promise<Game[]> {
        return await this.gameModel.find({ isSolved: false });
    }

    async findByIsSolvedAndLastMove(criteria: GameFilterCriteria): Promise<Game[]> {
        return await this.gameModel.find({
            isSolved: criteria.isSolved,
            lastMoveAt: criteria.lastMoveAt
        }).exec();
    }

    async findByLastMove(criteria: GameFilterCriteria): Promise<Game[]> {
        return await this.gameModel.find({
            lastMoveAt: criteria.lastMoveAt
        }).exec();
    }

    async deleteByLastMove(criteria: GameFilterCriteria): Promise<DeleteResult> {
        const deleteResult = await this.gameModel.deleteMany({
            lastMoveAt: criteria.lastMoveAt,
        });
        return deleteResult;
    }
}