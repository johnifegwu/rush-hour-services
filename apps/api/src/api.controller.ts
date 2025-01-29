import {
    Controller, Get, Post, Body, Param, HttpException, HttpStatus, HttpCode, NotFoundException,
    Query,
} from '@nestjs/common';
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

    @Post('create-board')
    @HttpCode(HttpStatus.CREATED)
    async createBoardEndpoint(@Body() createBoardDto: CreateBoardDto) {
        try {
            return await this.apiService.createBoard(createBoardDto);
        } catch (error) {
            throw new HttpException(
                'Failed to create board',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Post('start-game')
    @HttpCode(HttpStatus.CREATED)
    async startGameEndPoint(
        @Body() data: { boardId: string }
    ) {
        try {
            return await this.apiService.startGame(data.boardId);
        } catch (error) {
            throw new HttpException(
                'Failed to start game',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get(':gameId')
    async getGameEndPoint(@Param('gameId') gameId: string) {
        try {
            const game = await this.apiService.getGame(gameId);
            return game;
        } catch (error) {
            throw new HttpException(
                'Game not found',
                HttpStatus.NOT_FOUND
            );
        }
    }

    @Post(':gameId/move')
    async moveCarEndPoint(
        @Param('gameId') gameId: string,
        @Body() moveCarDto: MoveCarDto
    ) {
        try {
            return await this.apiService.moveCar(gameId, {
                carId: moveCarDto.carId,
                direction: moveCarDto.direction,
            });
        } catch (error) {
            throw new HttpException(
                'Invalid move',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get('boards')
    async getBoardsEndPoint(@Query('difficulty') difficulty?: string) {
        return this.apiService.getBoards(difficulty);
    }

    @Get('boards/:boardId')
    async getBoardEndPoint(@Param('boardId') boardId: string) {
        return this.apiService.getBoard(boardId);
    }

    @Get(':gameId/hint')
    async getHintEndPoint(@Param('gameId') gameId: string) {
        return this.apiService.getHint(gameId);
    }

    @Get(':gameId/solution')
    async getSolutionEndPoint(@Param('gameId') gameId: string) {
        return this.apiService.getSolution(gameId);
    }

    @Get(':gameId/analysis')
    async getAnalysisEndPoint(@Param('gameId') gameId: string) {
        return this.apiService.getAnalysis(gameId);
    }

    @Post(':gameId/abandon')
    async abandonGameEndPoint(@Param('gameId') gameId: string) {
        return this.apiService.abandonGame(gameId);
    }

    @Get('leaderboard')
    async getLeaderboardEndPoint(@Query('timeFrame') timeFrame: string) {
        return this.apiService.getLeaderboard(timeFrame);
    }
}