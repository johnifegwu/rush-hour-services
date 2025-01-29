import { Injectable } from '@nestjs/common';
import { GameService } from '../../../shared/src/services';

@Injectable()
export class ApiService {
    constructor(private readonly gameService: GameService) { }

    async moveCar(gameId: string, moveCarDto: MoveCarDto) {
        return this.gameService.moveCar(gameId, moveCarDto);
    }

    async createBoard(createBoardDto: CreateBoardDto) {
        return this.gameService.createBoard(createBoardDto);
    }

    async startGame(boardId: string) {
        return this.gameService.startGame(boardId);
    }

    async getGame(gameId: string) {
        return this.gameService.getGame(gameId);
    }
}