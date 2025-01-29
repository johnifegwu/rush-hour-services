import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    UseInterceptors,
    HttpStatus,
    ValidationPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery //    ApiBearerAuth,
} from '@nestjs/swagger';
import { GatewayService } from './gateway.service';
import { CreateBoardDto, MoveCarDto } from '../../../shared/src/dto';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { GameResponse, BoardResponse } from './interfaces/responses.interface';
import { ApiResponseInterceptor } from './interceptors/api-response.interceptor';

@ApiTags('Rush Hour Game')
@Controller('v1')
@UseInterceptors(LoggingInterceptor, ApiResponseInterceptor)
export class GatewayController {
    constructor(private readonly gatewayService: GatewayService) { }

    @Post('boards')
    @UseGuards(RateLimitGuard)
    @ApiOperation({ summary: 'Create a new game board' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Board created successfully',
        type: BoardResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid board configuration',
    })
    async createBoard(
        @Body(new ValidationPipe({ transform: true })) createBoardDto: CreateBoardDto
    ) {
        return this.gatewayService.createBoard(createBoardDto);
    }

    @Get('boards')
    @ApiOperation({ summary: 'Get all available boards' })
    @ApiQuery({
        name: 'difficulty',
        required: false,
        enum: ['easy', 'medium', 'hard'],
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'List of available boards',
        type: [BoardResponse],
    })
    async getBoards(@Query('difficulty') difficulty?: string) {
        return this.gatewayService.getBoards(difficulty);
    }

    @Get('boards/:boardId')
    @ApiOperation({ summary: 'Get board by ID' })
    @ApiParam({ name: 'boardId', description: 'Board ID' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Board details',
        type: BoardResponse,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Board not found',
    })
    async getBoard(@Param('boardId') boardId: string) {
        return this.gatewayService.getBoard(boardId);
    }

    @Post('games')
    @UseGuards(RateLimitGuard)
    @ApiOperation({ summary: 'Start a new game' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Game started successfully',
        type: GameResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid board ID',
    })
    async startGame(@Body('boardId') boardId: string) {
        return this.gatewayService.startGame(boardId);
    }

    @Get('games/:gameId')
    @ApiOperation({ summary: 'Get game status' })
    @ApiParam({ name: 'gameId', description: 'Game ID' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Game details',
        type: GameResponse,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Game not found',
    })
    async getGame(@Param('gameId') gameId: string) {
        return this.gatewayService.getGame(gameId);
    }

    @Put('games/:gameId/move')
    @UseGuards(RateLimitGuard)
    @ApiOperation({ summary: 'Make a move in the game' })
    @ApiParam({ name: 'gameId', description: 'Game ID' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Move executed successfully',
        type: GameResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid move',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Game not found',
    })
    async moveCar(
        @Param('gameId') gameId: string,
        @Body(new ValidationPipe({ transform: true })) moveCarDto: MoveCarDto
    ) {
        return this.gatewayService.moveCar(gameId, moveCarDto);
    }

    @Get('games/:gameId/hint')
    @ApiOperation({ summary: 'Get hint for next move' })
    @ApiParam({ name: 'gameId', description: 'Game ID' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Hint provided successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Game not found',
    })
    async getHint(@Param('gameId') gameId: string) {
        return this.gatewayService.getHint(gameId);
    }

    @Get('games/:gameId/solution')
    @ApiOperation({ summary: 'Get optimal solution for the game' })
    @ApiParam({ name: 'gameId', description: 'Game ID' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Solution provided successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Game not found',
    })
    async getSolution(@Param('gameId') gameId: string) {
        return this.gatewayService.getSolution(gameId);
    }

    @Get('games/:gameId/analysis')
    @ApiOperation({ summary: 'Get game analysis' })
    @ApiParam({ name: 'gameId', description: 'Game ID' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Game analysis provided successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Game not found',
    })
    async getAnalysis(@Param('gameId') gameId: string) {
        return this.gatewayService.getAnalysis(gameId);
    }

    @Delete('games/:gameId')
    @ApiOperation({ summary: 'Abandon game' })
    @ApiParam({ name: 'gameId', description: 'Game ID' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Game abandoned successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Game not found',
    })
    async abandonGame(@Param('gameId') gameId: string) {
        return this.gatewayService.abandonGame(gameId);
    }

    @Get('leaderboard')
    @ApiOperation({ summary: 'Get game leaderboard' })
    @ApiQuery({
        name: 'timeFrame',
        required: false,
        enum: ['daily', 'weekly', 'monthly', 'allTime'],
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Leaderboard retrieved successfully',
    })
    async getLeaderboard(@Query('timeFrame') timeFrame: string = 'allTime') {
        return this.gatewayService.getLeaderboard(timeFrame);
    }
}
