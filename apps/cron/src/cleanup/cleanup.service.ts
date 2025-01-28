import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Game } from '../../../../shared/src/schemas/game.schema';

@Injectable()
export class CleanupService {
    constructor(
        @InjectModel(Game.name) private readonly gameModel: Model<Game>,
    ) { }

    @Cron('*/10 * * * * *') // Runs every 10 seconds
    async handleGameCleanup() {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        await this.gameModel.deleteMany({
            lastMoveAt: { $lt: fiveMinutesAgo },
        });
    }
}