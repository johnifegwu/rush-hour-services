import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiService } from './api.service';
import { CreateBoardDto, MoveCarDto } from '../../../shared/src/dto';

@Controller()
export class ApiController {
    constructor(private readonly apiService: ApiService) { }

    @MessagePattern({ cmd: 'create_board' })
    async createBoard(data: CreateBoardDto) {
        return this.apiService.createBoard(data);
    }

    @MessagePattern({ cmd: 'start_game' })
    async startGame(data: { boardId: string }) {
        return this.apiService.startGame(data.boardId);
    }

    @MessagePattern({ cmd: 'get_game' })
    async getGame(data: { gameId: string }) {
        return this.apiService.getGame(data.gameId);
    }

    @MessagePattern({ cmd: 'move_car' })
    async moveCar(data: { gameId: string } & MoveCarDto) {
        return this.apiService.moveCar(data.gameId, {
            carId: data.carId,
            direction: data.direction,
        });
    }
}