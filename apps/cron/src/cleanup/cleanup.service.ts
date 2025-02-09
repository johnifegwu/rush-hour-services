import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '../../../../shared/src/services/redis.service';
import { IGameRepository } from '../../../../shared/src/interfaces/game-repository.interface';

export interface CleanupSummary {
    timestamp: Date;
    gamesDeleted: number;
    redisKeysDeleted: number;
    success: boolean;
    error?: string;
}

@Injectable()
export class CleanupService {
    private readonly logger = new Logger(CleanupService.name);
    private cleanupHistory: CleanupSummary[] = [];

    constructor(
        private readonly gameRepository: IGameRepository,
        private readonly redisService: RedisService
    ) { }

    @Cron(CronExpression.EVERY_10_SECONDS)
    async handleGameCleanup() {
        const summary: CleanupSummary = {
            timestamp: new Date(),
            gamesDeleted: 0,
            redisKeysDeleted: 0,
            success: false
        };

        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

            // Get inactive games
            const games = await this.gameRepository.findByLastMove({
                isSolved: false, // isSolved is actualy not needed
                lastMoveAt: { $lte: fiveMinutesAgo },
            });

            // Delete from Redis
            const redisResults = await Promise.all(
                games.map((game) => this.redisService.deleteGame(game.id.toString()))
            );

            // Delete from database
            const deleteResult = await this.gameRepository.deleteByLastMove({
                isSolved: false, // isSolved is actualy not needed
                lastMoveAt: { $lte: fiveMinutesAgo },
            });

            summary.gamesDeleted = deleteResult.deletedCount || 0;
            summary.redisKeysDeleted = redisResults.filter(Boolean).length;
            summary.success = true;

            this.logger.log(`Cleanup completed: ${summary.gamesDeleted} games deleted`);
        } catch (error: unknown) {
            summary.success = false;
            if (error instanceof Error) {
                summary.error = error.message;
                this.logger.error(`Cleanup failed: ${error.message}`);
            } else {
                summary.error = 'An unknown error occurred';
                this.logger.error(`Cleanup failed: An unknown error occurred`);
            }
        }

        this.cleanupHistory.push(summary);
        return summary;
    }


    getCleanupSummary(limit?: number): CleanupSummary[] {
        return limit
            ? this.cleanupHistory.slice(-limit)
            : [...this.cleanupHistory];
    }

    clearHistory(): void {
        this.cleanupHistory = [];
    }
}
