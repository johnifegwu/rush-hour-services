import { Controller, Post, Get, Put, Param, Body, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { CreateBoardDto } from '../../../shared/src/dto/create-board.dto';
import { MoveCarDto } from '../../../shared/src/dto/move-car.dto';

@ApiTags('game')
@Controller()
export class GameController {
    constructor(
        @Inject('API_SERVICE') private readonly apiClient: ClientProxy,
    ) { }

    @Post('create-board')
    @ApiOperation({ summary: 'Create a new board' })
    @ApiResponse({ status: 201, description: 'Board created successfully' })
    createBoard(@Body() createBoardDto: CreateBoardDto) {
        return this.apiClient.send({ cmd: 'create_board' }, createBoardDto);
    }

    @Post('start-game/:boardId')
    @ApiOperation({ summary: 'Start a new game' })
    startGame(@Param('boardId') boardId: string) {
        return this.apiClient.send({ cmd: 'start_game' }, { boardId });
    }

    @Get('game/:gameId')
    @ApiOperation({ summary: 'Get game state' })
    getGame(@Param('gameId') gameId: string) {
        return this.apiClient.send({ cmd: 'get_game' }, { gameId });
    }

    @Put('move-car/:gameId')
    @ApiOperation({ summary: 'Move a car on the board' })
    moveCar(
        @Param('gameId') gameId: string,
        @Body() moveCarDto: MoveCarDto,
    ) {
        return this.apiClient.send(
            { cmd: 'move_car' },
            { gameId, ...moveCarDto },
        );
    }
}