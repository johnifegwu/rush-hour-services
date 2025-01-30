import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    HttpException,
    HttpStatus,
    HttpCode,
    Query,
    Put,
    UseGuards,
    Logger,
} from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { CreateBoardDto, MoveCarDto } from '../../../shared/src/dto';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { AuthGuard } from './guards/auth.guard';

@Controller('game')
@UseGuards(RateLimitGuard)
export class GatewayController {
    private readonly logger = new Logger(GatewayController.name);

    constructor(private readonly gatewayService: GatewayService) { }

    @Post('create-board')
    @HttpCode(HttpStatus.CREATED)
    async createBoard(@Body() createBoardDto: CreateBoardDto) {
        try {
            const result = await this.gatewayService.createBoard(createBoardDto);
            this.logger.log(`Board created successfully`);
            return result;
        } catch (error) {
            this.logger.error(`Failed to create board: ${error.message}`);
            throw new HttpException(
                'Failed to create board',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Post('start-game')
    @HttpCode(HttpStatus.CREATED)
    async startGame(@Body() data: { boardId: string }) {
        try {
            const result = await this.gatewayService.startGame(data.boardId);
            this.logger.log(`Game started with board ID: ${data.boardId}`);
            return result;
        } catch (error) {
            this.logger.error(`Failed to start game: ${error.message}`);
            throw new HttpException(
                'Failed to start game',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get(':gameId')
    async getGame(@Param('gameId') gameId: string) {
        try {
            const game = await this.gatewayService.getGame(gameId);
            this.logger.log(`Retrieved game: ${gameId}`);
            return game;
        } catch (error) {
            this.logger.error(`Failed to get game ${gameId}: ${error.message}`);
            throw new HttpException(
                'Game not found',
                HttpStatus.NOT_FOUND
            );
        }
    }

    @Put(':gameId/move')
    async moveCar(
        @Param('gameId') gameId: string,
        @Body() moveCarDto: MoveCarDto
    ) {
        try {
            const result = await this.gatewayService.moveCar(gameId, moveCarDto);
            this.logger.log(`Car moved in game ${gameId}`);
            return result;
        } catch (error) {
            this.logger.error(`Invalid move in game ${gameId}: ${error.message}`);
            throw new HttpException(
                'Invalid move',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get(':gameId/move')
    async getValidMoves(@Param('gameId') gameId: string) {
        try {
            const moves = await this.gatewayService.getValidMoves(gameId);
            this.logger.log(`Retrieved valid moves for game ${gameId}`);
            return moves;
        } catch (error) {
            this.logger.error(`Failed to get moves for game ${gameId}: ${error.message}`);
            throw new HttpException(
                'Move not found',
                HttpStatus.NOT_FOUND
            );
        }
    }

    @Get('boards')
    async getBoards(@Query('difficulty') difficulty?: string) {
        try {
            const boards = await this.gatewayService.getBoards(difficulty);
            this.logger.log(`Retrieved boards with difficulty: ${difficulty || 'all'}`);
            return boards;
        } catch (error) {
            this.logger.error(`Failed to get boards: ${error.message}`);
            throw new HttpException(
                'Failed to retrieve boards',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('boards/:boardId')
    async getBoard(@Param('boardId') boardId: string) {
        try {
            const board = await this.gatewayService.getBoard(boardId);
            this.logger.log(`Retrieved board: ${boardId}`);
            return board;
        } catch (error) {
            this.logger.error(`Failed to get board ${boardId}: ${error.message}`);
            throw new HttpException(
                'Board not found',
                HttpStatus.NOT_FOUND
            );
        }
    }

    @Get(':gameId/hint')
    @UseGuards(AuthGuard) // Optional: Add auth guard for premium features
    async getHint(@Param('gameId') gameId: string) {
        try {
            const hint = await this.gatewayService.getHint(gameId);
            this.logger.log(`Hint provided for game ${gameId}`);
            return hint;
        } catch (error) {
            this.logger.error(`Failed to get hint for game ${gameId}: ${error.message}`);
            throw new HttpException(
                'Failed to get hint',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get(':gameId/solution')
    @UseGuards(AuthGuard) // Optional: Add auth guard for premium features
    async getSolution(@Param('gameId') gameId: string) {
        try {
            const solution = await this.gatewayService.getSolution(gameId);
            this.logger.log(`Solution provided for game ${gameId}`);
            return solution;
        } catch (error) {
            this.logger.error(`Failed to get solution for game ${gameId}: ${error.message}`);
            throw new HttpException(
                'Failed to get solution',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Put(':gameId/create-analysis')
    async createAnalysis(@Param('gameId') gameId: string) {
        try {
            const analysis = await this.gatewayService.createAnalysis(gameId);
            this.logger.log(`Analysis created for game ${gameId}`);
            return analysis;
        } catch (error) {
            this.logger.error(`Failed to create analysis for game ${gameId}: ${error.message}`);
            throw new HttpException(
                'Failed to create analysis',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get(':gameId/analysis')
    async getAnalysis(@Param('gameId') gameId: string) {
        try {
            const analysis = await this.gatewayService.getAnalysis(gameId);
            this.logger.log(`Retrieved analysis for game ${gameId}`);
            return analysis;
        } catch (error) {
            this.logger.error(`Failed to get analysis for game ${gameId}: ${error.message}`);
            throw new HttpException(
                'Analysis not found',
                HttpStatus.NOT_FOUND
            );
        }
    }

    @Post(':gameId/abandon')
    async abandonGame(@Param('gameId') gameId: string) {
        try {
            const result = await this.gatewayService.abandonGame(gameId);
            this.logger.log(`Game ${gameId} abandoned`);
            return result;
        } catch (error) {
            this.logger.error(`Failed to abandon game ${gameId}: ${error.message}`);
            throw new HttpException(
                'Failed to abandon game',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get('leaderboard')
    async getLeaderboard(@Query('timeFrame') timeFrame: string) {
        try {
            const leaderboard = await this.gatewayService.getLeaderboard(timeFrame);
            this.logger.log(`Retrieved leaderboard for timeframe: ${timeFrame}`);
            return leaderboard;
        } catch (error) {
            this.logger.error(`Failed to get leaderboard: ${error.message}`);
            throw new HttpException(
                'Failed to retrieve leaderboard',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
