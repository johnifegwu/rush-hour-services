import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreateBoardDto, MoveCarDto } from '../../../shared/src/dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GatewayService {
    constructor(
        @Inject('API_SERVICE') private readonly apiClient: ClientProxy,
    ) { }

    async createBoard(createBoardDto: CreateBoardDto) {
        return firstValueFrom(
            this.apiClient.send({ cmd: 'create_board' }, createBoardDto)
        );
    }

    async startGame(boardId: string) {
        return firstValueFrom(
            this.apiClient.send({ cmd: 'start_game' }, { boardId })
        );
    }

    async getGame(gameId: string) {
        return firstValueFrom(
            this.apiClient.send({ cmd: 'get_game' }, { gameId })
        );
    }

    async moveCar(gameId: string, moveCarDto: MoveCarDto) {
        return firstValueFrom(
            this.apiClient.send({ cmd: 'move_car' }, { gameId, ...moveCarDto })
        );
    }
}