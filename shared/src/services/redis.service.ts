import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { Game } from '../schemas/game.schema';
import { ConfigService } from '@nestjs/config';
import { AnalysisResult } from '../interfaces/rush-hour.interface';

@Injectable()
export class RedisService {
    private client: Redis;

    constructor(private configService: ConfigService) {
        // Parse the Redis URI to extract connection details
        const url = new URL(this.configService.get<string>('REDIS_URI', 'redis://redis:6379'));
        console.log('Redis URL:', url);

        this.client = new Redis({
            host: url.hostname,
            port: parseInt(url.port, 10) || 6379,
            username: url.username || undefined,
            password: url.password || undefined,
            retryStrategy: (times: number) => {
                // Retry with exponential backoff
                return Math.min(times * 50, 2000);
            }
        });

        this.client.on('error', (err: any) => {
            console.error('Redis client error:', err);
        });

        this.client.on('connect', () => {
            console.log('Successfully connected to Redis');
        });
    }

    async onModuleDestroy() {
        await this.client.quit();
    }

    getClient(): Redis {
        return this.client;
    }

    async setGame(gameId: string, game: Game): Promise<void> {
        try {
            await this.client.set(
                `game:${gameId}`,
                JSON.stringify(game),
                'EX',
                300 // 5 minutes expiration
            );
        } catch (error) {
            console.error('Redis setGame error:', error);
            throw error;
        }
    }

    async getGame(gameId: string): Promise<Game | null> {
        try {
            const gameData = await this.client.get(`game:${gameId}`);
            if (!gameData) return null;

            const game = JSON.parse(gameData) as Game;
            // Convert string dates back to Date objects
            if (game.lastMoveAt) {
                game.lastMoveAt = new Date(game.lastMoveAt);
            }
            if (game.moves) {
                game.moves = game.moves.map(move => ({
                    ...move,
                    timestamp: new Date(move.timestamp)
                }));
            }
            return game;
        } catch (error) {
            console.error('Redis getGame error:', error);
            throw error;
        }
    }

    async set(key: string, value: string | number): Promise<void> {
        try {
            await this.client.set(key, value, 'EX', 300);
        } catch (error) {
            console.error('Redis set error:', error);
            throw error;
        }
    }

    async get(key: string): Promise<string | null> {
        try {
            return await this.client.get(key);
        } catch (error) {
            console.error('Redis get error:', error);
            throw error;
        }
    }

    async saveAnalysisResult(gameId: string, analysis: AnalysisResult): Promise<void> {
        try {
            await this.client.set(
                `analysis:${gameId}`,
                JSON.stringify(analysis),
                'EX',
                300
            );
        } catch (error) {
            console.error('Redis saveAnalysisResult error:', error);
            throw error;
        }
    }

    async getAnalysisResult(gameId: string): Promise<AnalysisResult | null> {
        try {
            const analysisData = await this.client.get(`analysis:${gameId}`);
            return analysisData ? JSON.parse(analysisData) as AnalysisResult : null;
        } catch (error) {
            console.error('Redis getAnalysisResult error:', error);
            throw error;
        }
    }

    async deleteGame(gameId: string): Promise<void> {
        try {
            const keys = await this.client.keys(`state:${gameId}:*`);

            // Create a pipeline for batch operations
            const pipeline = this.client.pipeline();

            // Add delete operations to pipeline
            pipeline.del(`game:${gameId}`);
            pipeline.del(`analysis:${gameId}`);
            keys.forEach(key => pipeline.del(key));

            // Execute all operations atomically
            await pipeline.exec();
        } catch (error) {
            console.error('Redis deleteGame error:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        try {
            await this.client.quit();
        } catch (error) {
            console.error('Redis disconnect error:', error);
            throw error;
        }
    }
}
