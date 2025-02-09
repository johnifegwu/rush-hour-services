import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Board } from '../../schemas/board.schema';
import { IBoardRepository } from '../../interfaces/board-repository.interface';
import { BaseMongoRepository } from './base.repository';

@Injectable()
export class BoardMongoRepository extends BaseMongoRepository<Board> implements IBoardRepository {
    constructor(
        @InjectModel(Board.name) private boardModel: Model<Board>
    ) {
        super(boardModel);
    }

    async findByDifficulty(difficulty: string): Promise<Board[]> {
        return await this.boardModel.find({ difficulty });
    }
}