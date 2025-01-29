import { Injectable } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { Game, AnalysisResult } from '../interfaces/rush-hour.interface';

@Injectable()
export class RedisService {
    private client;

    constructor() {
        this.client = createClient({
            url: 'redis://redis:6379'
        });
        this.client.connect();
    }

    // Add this getter method
    getClient(): RedisClientType {
        return this.client;
    }

    async setGame(gameId: string, game: Game): Promise<void> {
        await this.client.set(
            `game:${gameId}`,
            JSON.stringify(game),
            { EX: 2400 } // 40 minutes expiration : will kick-in if cron jobs failed for any reason.
        );
    }

    async set(key: string, value: number): Promise<void> {
        await this.client.set(`state:${key}`, value, { EX: 2400 });// 40 minutes expiration 
    }

    async get(key: string): Promise<number | null> {
        return await this.client.get(`state:${key}`);
    }

    async getAllGames(): Promise<Game[]> {
        try {
            // Get all game keys
            const gameKeys = await this.client.keys('game:*');

            if (gameKeys.length === 0) {
                return [];
            }

            // Get all games data
            const gamesData = await Promise.all(
                gameKeys.map(key => this.client.get(key))
            );

            // Parse and filter out any invalid data
            return gamesData
                .filter(data => data !== null)
                .map(data => JSON.parse(data));

        } catch (error) {
            console.error('Error fetching all games from Redis:', error);
            throw error;
        }
    }

    //Deletes a Game from Redis including all the Game States.
    async deleteGame(gameId: string): Promise<void> {
        try {
            await this.client.del(`game:${gameId}`);
            await this.deleteGameState(gameId);
        } catch (error) {
            console.error(`Error deleting game ${gameId} from Redis:`, error);
            throw error;
        }
    }

    //Deletes Game States.
    async deleteGameState(gameId: string): Promise<void> {
        try {
            // delete the game states
            const keys = await this.client.keys(`state:${gameId}:*`);
            if (keys.length === 0) {
                return;
            }
            if (keys) await Promise.all(keys.map(key => this.client.del(key)));
        } catch (error) {
            console.error(`Error deleting game ${gameId} from Redis:`, error);
            throw error;
        }
    }

    async getGame(gameId: string): Promise<Game | null> {
        const game = await this.client.get(`game:${gameId}`);
        return game ? JSON.parse(game) : null;
    }

    //Create functions to Save, Get and Delete AnalysisResult using gameid
    async saveAnalysisResult(gameId: string, analysisResult: AnalysisResult): Promise<void> {
        await this.client.set(
            `analysis:${gameId}`,
            JSON.stringify(analysisResult),
            { EX: 2400 } // 40 minutes expiration
        );
    }

    async getAnalysisResult(gameId: string): Promise<AnalysisResult | null> {
        const analysisResult = await this.client.get(`analysis:${gameId}`);
        return analysisResult ? JSON.parse(analysisResult) : null;
    }

    async deleteAnalysisResult(gameId: string): Promise<void> {
        await this.client.del(`analysis:${gameId}`);
    }

}