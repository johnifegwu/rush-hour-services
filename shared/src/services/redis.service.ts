import { Injectable } from '@nestjs/common';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { Game } from '../schemas/game.schema';
import { AnalysisResult } from '../interfaces/rush-hour.interface';

@Injectable()
export class RedisService {
    private client: RedisClientType;

    constructor() {
        this.client = createClient({
            url: process.env['REDIS_URI'] || `redis://localhost:${process.env['REDIS_PORT'] || 6379}`
        });

        this.client.connect().catch(err => {
            console.error('Redis connection error:', err);
        });

        this.client.on('error', (err) => {
            console.error('Redis client error:', err);
        });
    }

    getClient(): RedisClientType {
        if (!this.client.isOpen) {
            this.client.connect().catch(err => {
                console.error('Redis reconnection error:', err);
            });
        }
        return this.client;
    }

    async setGame(gameId: string, game: Game): Promise<void> {
        try {
            await this.client.set(
                `game:${gameId}`,
                JSON.stringify(game),
                { EX: 300 } // 5 minutes expiration
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
            await this.client.set(
                key,
                value,
                { EX: 300 } // 5 minutes expiration
            );
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
                { EX: 300 } // 5 minutes expiration
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

    async del(key: string): Promise<void> {
        try {
            await this.client.del(key);
        } catch (error) {
            console.error('Redis del error:', error);
            throw error;
        }
    }

    async deleteGame(gameId: string): Promise<void> {
        try {
            //get all keys that starts with 'state:${gameId}:*'
            const keys = await this.client.keys(`state:${gameId}:*`);

            // Delete game from redis
            await this.client.del(gameId);

            // Delete game analysis
            await this.client.del(`analysis:${gameId}`);

            // using Promise.All delete all states from redis with keys.map
            await Promise.all(keys.map(key => this.client.del(key)));

        } catch (error) {
            console.error('Redis del error:', error);
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
