// shared/src/cron/game.cron.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '../services/redis.service';
import { RabbitMQService } from '../services/rabbitmq.service';
import { Game, Board } from '../interfaces';

@Injectable()
export class GameCronService {
    private readonly INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
    private readonly BATCH_SIZE = 100; // Process in smaller batches for better performance

    constructor(
        @InjectModel('game') private readonly gameModel: Model<Game>,
        @InjectModel('board') private readonly boardModel: Model<Board>,
        private readonly redisService: RedisService,
        private readonly rabbitMQService: RabbitMQService
    ) { }

    @Cron('*/10 * * * * *') // Runs every 10 seconds
    async cleanupInactiveGames() {
        try {
            const inactiveThreshold = new Date(Date.now() - this.INACTIVE_TIMEOUT);

            // Get all games from Redis
            const allGames = await this.redisService.getAllGames();

            // Filter inactive games
            const inactiveGames = allGames.filter(game =>
                new Date(game.lastMoveAt) < inactiveThreshold
            );

            if (inactiveGames.length === 0) {
                return; // No inactive games to process
            }

            console.log(`Found ${inactiveGames.length} inactive games to cleanup`);

            // Process in batches
            for (const batch of this.batchArray(inactiveGames, this.BATCH_SIZE)) {
                await this.processInactiveGamesBatch(batch);
            }

        } catch (error) {
            console.error('Error in cleanup cron job:', error);
        }
    }

    private async processInactiveGamesBatch(games: Game[]) {
        const gameIds = games.map(game => game.id);

        try {
            // Archive games to database if they have moves
            const gamesToArchive = games.filter(game => game.moves.length > 0);
            if (gamesToArchive.length > 0) {
                await this.archiveGamesToDatabase(gamesToArchive);
            }

            // Delete games from Redis
            await Promise.all(
                gameIds
                    .filter((gameId): gameId is string => gameId !== undefined && gameId !== null)
                    .map(gameId => this.redisService.deleteGame(gameId))
            );


            console.log(`Successfully processed batch of ${gameIds.length} games`);

        } catch (error) {
            console.error('Error processing inactive games batch:', error);
            // Log specific games that failed
            console.error('Failed game IDs:', gameIds);
            throw error;
        }
    }

    private async archiveGamesToDatabase(games: Game[]) {
        try {
            // Create archive records in database
            const archivePromises = games.map(game =>
                this.gameModel.create({
                    boardId: game.boardId,
                    moves: game.moves,
                    currentState: game.currentState,
                    lastMoveAt: game.lastMoveAt,
                    isSolved: game.isSolved,
                    minimumMovesRequired: game.minimumMovesRequired
                })
            );

            await Promise.all(archivePromises);

            // Optionally send to archive queue for additional processing
            await this.rabbitMQService.sendToQueue('game_archival', {
                type: 'GAMES_ARCHIVED',
                count: games.length,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Error archiving games to database:', error);
            throw error;
        }
    }

    private batchArray<T>(array: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }
        return batches;
    }
}
