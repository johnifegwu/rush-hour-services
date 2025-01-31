import { Injectable } from '@nestjs/common';
import { GameService } from '.././../../shared/src/services';
import { CreateBoardDto, MoveCarDto } from '../../../shared/src/dto';

@Injectable()
export class ApiService {
    constructor(private readonly gameService: GameService) { }

    async moveCar(gameId: string, moveCarDto: MoveCarDto) {
        return await this.gameService.moveCar(gameId, moveCarDto);
    }

    async getMoveCar(gameId: string) {
        return await this.gameService.getMoveCarResult(gameId);
    }

    async createBoard(createBoardDto: CreateBoardDto) {
        return this.gameService.createBoard(createBoardDto.matrix);
    }

    async startGame(boardId: string) {
        return await this.gameService.startGame(boardId);
    }

    async getGame(gameId: string) {
        return await this.gameService.getGame(gameId);
    }

    async getBoards(difficulty?: string) {
        return await this.gameService.getBoards(difficulty);
    }

    async getBoard(boardId: string) {
        return await this.gameService.getBoard(boardId);
    }

    async getHint(gameId: string) {
        return await this.gameService.getHint(gameId);
    }

    async getSolution(gameId: string) {
        return await this.gameService.getSolution(gameId);
    }

    async createAnalysis(gameId: string) {
        return await this.gameService.createAnalysis(gameId);
    }

    async getAnalysis(gameId: string) {
        return await this.gameService.getAnalysis(gameId);
    }

    async abandonGame(gameId: string) {
        return await this.gameService.abandonGame(gameId);
    }

    async getLeaderboard(timeFrame: string) {
        return await this.gameService.getLeaderboard(timeFrame);
    }
}