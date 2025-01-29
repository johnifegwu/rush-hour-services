import { Controller, Post, Get, Put, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GatewayService } from './gateway.service';
import { CreateBoardDto, MoveCarDto } from '../../../shared/src/dto';

@ApiTags('Rush Hour Game')
@Controller()
export class GatewayController {
    constructor(private readonly gatewayService: GatewayService) { }

    @Post('create-board')
    @ApiOperation({ summary: 'Create a new game board' })
    @ApiResponse({ status: 201, description: 'Board created successfully' })
    async createBoard(@Body() createBoardDto: CreateBoardDto) {
        return this.gatewayService.createBoard(createBoardDto);
    }

    @Post('start-game/:boardId')
    @ApiOperation({ summary: 'Start a new game with specified board' })
    async startGame(@Param('boardId') boardId: string) {
        return this.gatewayService.startGame(boardId);
    }

    @Get('game/:gameId')
    @ApiOperation({ summary: 'Get current game state' })
    async getGame(@Param('gameId') gameId: string) {
        return this.gatewayService.getGame(gameId);
    }

    @Put('move-car/:gameId')
    @ApiOperation({ summary: 'Make a move in the game' })
    async moveCar(
        @Param('gameId') gameId: string,
        @Body() moveCarDto: MoveCarDto,
    ) {
        return this.gatewayService.moveCar(gameId, moveCarDto);
    }
}