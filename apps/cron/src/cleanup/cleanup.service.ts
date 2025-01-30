import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Game } from 'shared/src/schemas/game.schema';
import { RedisService } from 'shared/src/services/redis.service';

@Injectable()
export class CleanupService {
    constructor(
        @InjectModel(Game.name) private readonly gameModel: Model<Game>,
        private readonly redisService: RedisService
    ) { }

    @Cron('*/10 * * * * *') // Runs every 10 seconds
    async handleGameCleanup() {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        //Delete all inactive games from the database and redis
        try {
            // Get gameIds from database where lastMoveAt 
            // is equal to or greater than 5 minutes
            const games = await this.gameModel.find({
                lastMoveAt: { $gte: fiveMinutesAgo },
            });

            // Extract ids from games and delete redis records 
            // for each of the games affected
            Promise.all(games.map((game) => this.redisService.deleteGame(game.id.toString())));

            // Delete from database also
            await this.gameModel.deleteMany({
                lastMoveAt: { $gte: fiveMinutesAgo },
            });

        } catch (error) {
            console.log(`Error while deleting inactive games from DB ${error}`)
        }
    }
}