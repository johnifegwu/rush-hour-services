import {
    Controller, Get, Post, Body, Param, HttpException, HttpStatus, HttpCode,
    Query,
    Put,
    Logger,
} from '@nestjs/common';
import { ApiService } from './api.service';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBody,
    ApiQuery
} from '@nestjs/swagger';
import { CreateBoardDto, MoveCarDto, StartGameDto } from '../../../shared/src/dto';

@ApiTags('Rush Hour Game')
@Controller()
export class ApiController {
    constructor(private readonly apiService: ApiService) { }

    @Post('create-board')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new game board' })
    @ApiBody({ type: CreateBoardDto })
    @ApiResponse({ status: 201, description: 'Board successfully created' })
    @ApiResponse({ status: 400, description: 'Failed to create board' })
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
    @ApiOperation({ summary: 'Start a new game' })
    @ApiBody({ type: StartGameDto })
    @ApiResponse({ status: 200, description: 'Game successfully started' })
    @ApiResponse({ status: 400, description: 'Failed to start game' })
    async startGameEndPoint(
        @Body() data: StartGameDto
    ) {
        try {
            Logger.log(
                `Starting game with boardId ${data.boardId}`
            );
            return await this.apiService.startGame(data.boardId);
        } catch (error) {
            Logger.log(
                `Starting game with boardId ${data.boardId} failed: ${error}`
            );
            throw new HttpException(
                `Failed to start game:${error}`,
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get(':gameId')
    @ApiOperation({ summary: 'Get game details' })
    @ApiParam({ name: 'gameId', description: 'ID of the game' })
    @ApiResponse({ status: 200, description: 'Game details retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Game not found' })
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
    @ApiOperation({ summary: 'Make a car move' })
    @ApiParam({ name: 'gameId', description: 'ID of the game' })
    @ApiBody({ type: MoveCarDto })
    @ApiResponse({ status: 200, description: 'Move successful' })
    @ApiResponse({ status: 400, description: 'Invalid move' })
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
            Logger.log(
                `Error starting game ${error}`
            );
            throw new HttpException(
                'Invalid move',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get(':gameId/move')
    @ApiOperation({ summary: 'Get valid moves for current game state' })
    @ApiParam({ name: 'gameId', description: 'ID of the game' })
    @ApiResponse({ status: 200, description: 'Valid moves retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Move not found' })
    async getValidMovesEndPoint(@Param('gameId') gameId: string) {
        try {
            return await this.apiService.getGame(gameId);
        } catch (error) {
            Logger.log(
                `Error getting valid moves ${error}`
            );
            throw new HttpException(
                'Move not found',
                HttpStatus.NOT_FOUND
            );
        }
    }

    @Get('boards')
    @ApiOperation({ summary: 'Get all available boards' })
    @ApiQuery({
        name: 'difficulty',
        required: false,
        description: 'Filter boards by difficulty level'
    })
    @ApiResponse({ status: 200, description: 'Boards retrieved successfully' })
    async getBoardsEndPoint(@Query('difficulty') difficulty?: string) {
        try {
            return await this.apiService.getBoards(difficulty);
        } catch (error) {
            Logger.log(
                `Error getting boards ${error}`
            );
            throw new HttpException(
                'Boards not found',
                HttpStatus.NOT_FOUND
            );
        }
    }

    @Get('boards/:boardId')
    @ApiOperation({ summary: 'Get specific board details' })
    @ApiParam({ name: 'boardId', description: 'ID of the board' })
    @ApiResponse({ status: 200, description: 'Board details retrieved successfully' })
    async getBoardEndPoint(@Param('boardId') boardId: string) {
        try {
            return await this.apiService.getBoard(boardId);
        } catch (error) {
            Logger.log(
                `Error getting boards ${error}`
            );
            throw new HttpException(
                'Boards not found',
                HttpStatus.NOT_FOUND
            );
        }
    }

    @Get(':gameId/hint')
    @ApiOperation({ summary: 'Get hint for current game state' })
    @ApiParam({ name: 'gameId', description: 'ID of the game' })
    @ApiResponse({ status: 200, description: 'Hint retrieved successfully' })
    async getHintEndPoint(@Param('gameId') gameId: string) {
        try {
            return await this.apiService.getHint(gameId);
        } catch (error) {
            Logger.log(
                `Error getting hints ${error}`
            );
            throw new HttpException(
                'Hints not found',
                HttpStatus.NOT_FOUND
            );
        }
    }

    @Get(':gameId/solution')
    @ApiOperation({ summary: 'Get solution for the game' })
    @ApiParam({ name: 'gameId', description: 'ID of the game' })
    @ApiResponse({ status: 200, description: 'Solution retrieved successfully' })
    async getSolutionEndPoint(@Param('gameId') gameId: string) {
        try {
            return await this.apiService.getSolution(gameId);
        } catch (error) {
            Logger.log(
                `Error getting solutions ${error}`
            );
            throw new HttpException(
                'Solutions not found',
                HttpStatus.NOT_FOUND
            );
        }
    }

    @Put(':gameId/create-analysis')
    @ApiOperation({ summary: 'Create game analysis' })
    @ApiParam({ name: 'gameId', description: 'ID of the game' })
    @ApiResponse({ status: 200, description: 'Analysis created successfully' })
    async CreateAnalysisEndPoint(@Param('gameId') gameId: string) {
        try {
            return await this.apiService.createAnalysis(gameId);
        } catch (error) {
            Logger.log(
                `Error creating analysis ${error}`
            );
            throw new HttpException(
                'Create Analysis failed',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get(':gameId/analysis')
    @ApiOperation({ summary: 'Get game analysis' })
    @ApiParam({ name: 'gameId', description: 'ID of the game' })
    @ApiResponse({ status: 200, description: 'Analysis retrieved successfully' })
    async getAnalysisEndPoint(@Param('gameId') gameId: string) {
        try {
            return await this.apiService.getAnalysis(gameId);
        } catch (error) {
            Logger.log(
                `Error getting analysis ${error}`
            );
            throw new HttpException(
                'Analysis not found',
                HttpStatus.NOT_FOUND
            );
        }
    }

    @Post(':gameId/abandon')
    @ApiOperation({ summary: 'Abandon current game' })
    @ApiParam({ name: 'gameId', description: 'ID of the game' })
    @ApiResponse({ status: 200, description: 'Game abandoned successfully' })
    async abandonGameEndPoint(@Param('gameId') gameId: string) {
        try {
            return await this.apiService.abandonGame(gameId);
        } catch (error) {
            Logger.log(
                `Error abandoning game ${error}`
            );
            throw new HttpException(
                'Abandon game failed',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get('leaderboard')
    @ApiOperation({ summary: 'Get game leaderboard' })
    @ApiQuery({
        name: 'timeFrame',
        required: true,
        description: 'Time frame for leaderboard (e.g., "daily", "weekly", "monthly")'
    })
    @ApiResponse({ status: 200, description: 'Leaderboard retrieved successfully' })
    async getLeaderboardEndPoint(@Query('timeFrame') timeFrame: string) {
        try {
            return await this.apiService.getLeaderboard(timeFrame);
        } catch (error) {
            Logger.log(
                `Error getting Leaderboard ${error}`
            );
            throw new HttpException(
                'Leaderboard not found',
                HttpStatus.NOT_FOUND
            );
        }
    }
}