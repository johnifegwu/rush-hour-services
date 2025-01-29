import { Injectable } from '@nestjs/common';
import { createClient } from 'redis';
import { Game } from '../interfaces/rush-hour.interface';

@Injectable()
export class RedisService {
    private client;

    constructor() {
        this.client = createClient({
            url: 'redis://redis:6379'
        });
        this.client.connect();
    }

    async setGame(gameId: string, game: Game): Promise<void> {
        await this.client.set(
            `game:${gameId}`,
            JSON.stringify(game),
            { EX: 300 } // 5 minutes expiration
        );
    }

    async set(key: string, value: number): Promise<void> {
        await this.client.set(key, value);
    }

    async get(key: string): Promise<number | null> {
        return await this.client.get(key);
    }

    async getGame(gameId: string): Promise<Game | null> {
        const game = await this.client.get(`game:${gameId}`);
        return game ? JSON.parse(game) : null;
    }

    async deleteGame(gameId: string): Promise<void> {
        await this.client.del(`game:${gameId}`);
    }
}