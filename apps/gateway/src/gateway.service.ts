import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CreateBoardDto, MoveCarDto } from '../../../shared/src/dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GatewayService {
    constructor(private readonly httpService: HttpService) { }

    private readonly API_URL = process.env.API_URL || 'http://localhost:3001';

    async createBoard(createBoardDto: CreateBoardDto) {
        const { data } = await firstValueFrom(
            this.httpService.post(`${this.API_URL}/create-board`, createBoardDto)
        );
        return data;
    }

    async startGame(boardId: string) {
        const { data } = await firstValueFrom(
            this.httpService.post(`${this.API_URL}/start-game`, { boardId })
        );
        return data;
    }

    async getGame(gameId: string) {
        const { data } = await firstValueFrom(
            this.httpService.get(`${this.API_URL}/${gameId}`)
        );
        return data;
    }

    async moveCar(gameId: string, moveCarDto: MoveCarDto) {
        const { data } = await firstValueFrom(
            this.httpService.put(`${this.API_URL}/${gameId}/move`, moveCarDto)
        );
        return data;
    }

    async getValidMoves(gameId: string) {
        const { data } = await firstValueFrom(
            this.httpService.get(`${this.API_URL}/${gameId}/move`)
        );
        return data;
    }

    async getBoards(difficulty?: string) {
        const { data } = await firstValueFrom(
            this.httpService.get(`${this.API_URL}/boards`, {
                params: { difficulty }
            })
        );
        return data;
    }

    async getBoard(boardId: string) {
        const { data } = await firstValueFrom(
            this.httpService.get(`${this.API_URL}/boards/${boardId}`)
        );
        return data;
    }

    async getHint(gameId: string) {
        const { data } = await firstValueFrom(
            this.httpService.get(`${this.API_URL}/${gameId}/hint`)
        );
        return data;
    }

    async getSolution(gameId: string) {
        const { data } = await firstValueFrom(
            this.httpService.get(`${this.API_URL}/${gameId}/solution`)
        );
        return data;
    }

    async createAnalysis(gameId: string) {
        const { data } = await firstValueFrom(
            this.httpService.put(`${this.API_URL}/${gameId}/create-analysis`, {})
        );
        return data;
    }

    async getAnalysis(gameId: string) {
        const { data } = await firstValueFrom(
            this.httpService.get(`${this.API_URL}/${gameId}/analysis`)
        );
        return data;
    }

    async abandonGame(gameId: string) {
        const { data } = await firstValueFrom(
            this.httpService.post(`${this.API_URL}/${gameId}/abandon`, {})
        );
        return data;
    }

    async getLeaderboard(timeFrame: string) {
        const { data } = await firstValueFrom(
            this.httpService.get(`${this.API_URL}/leaderboard`, {
                params: { timeFrame }
            })
        );
        return data;
    }
}
