import {
    Controller, Get, Post, Body, Param, HttpException, HttpStatus, HttpCode,
    Query,
    Put,
} from '@nestjs/common';
import { ApiService } from './api.service';
import { CreateBoardDto, MoveCarDto } from 'shared/src/dto';

@Controller()
export class ApiController {
    constructor(private readonly apiService: ApiService) { }

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

    @Put(':gameId/move')
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

    @Get(':gameId/move')
    async getValidMovesEndPoint(@Param('gameId') gameId: string) {
        try {
            return await this.apiService.getGame(gameId);
        } catch (error) {
            throw new HttpException(
                'Move not found',
                HttpStatus.NOT_FOUND
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

    @Put(':gameId/create-analysis')
    async CreateAnalysisEndPoint(@Param('gameId') gameId: string) {
        return this.apiService.createAnalysis(gameId);
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