import { Injectable } from '@nestjs/common';
import { GameService } from '../../../shared/src/services';
import { CreateBoardDto, MoveCarDto } from 'shared/src/dto';

@Injectable()
export class ApiService {
    constructor(private readonly gameService: GameService) { }

    async moveCar(gameId: string, moveCarDto: MoveCarDto) {
        return this.gameService.moveCar(gameId, moveCarDto);
    }

    async createBoard(createBoardDto: CreateBoardDto) {
        return this.gameService.createBoard(createBoardDto.matrix);
    }

    async startGame(boardId: string) {
        return this.gameService.startGame(boardId);
    }

    async getGame(gameId: string) {
        return this.gameService.getGame(gameId);
    }

    async getBoards(difficulty?: string) {
        return this.gameService.getBoards(difficulty);
    }

    async getBoard(boardId: string) {
        return this.gameService.getBoard(boardId);
    }

    async getHint(gameId: string) {
        return this.gameService.getHint(gameId);
    }

    async getSolution(gameId: string) {
        return this.gameService.getSolution(gameId);
    }

    async getAnalysis(gameId: string) {
        return this.gameService.getAnalysis(gameId);
    }

    async abandonGame(gameId: string) {
        return this.gameService.abandonGame(gameId);
    }

    async getLeaderboard(timeFrame: string) {
        return this.gameService.getLeaderboard(timeFrame);
    }
}