import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Model } from 'mongoose';
import { GameService } from './game.service';
import { RedisService } from './redis.service';
import { RabbitMQService } from './rabbitmq.service';
import { Board } from '../schemas/board.schema';
import { Game } from '../schemas/game.schema';
import { getModelToken } from '@nestjs/mongoose';

import {
    MovementDirection,
    GameMove,
    AnalysisResult
} from '../interfaces/rush-hour.interface';
import { NotFoundException } from '../exceptions';

// Test interfaces
interface TestResult {
    category: string;
    test: string;
    passed: boolean;
}

interface CategoryResult {
    passed: number;
    failed: number;
    successRate: number;
}

// Define base interfaces for mocking
interface BaseMockGame {
    _id: string;
    boardId: string;
    currentState: number[][];
    moves: GameMove[];
    lastMoveAt: Date;
    isSolved: boolean;
    minimumMovesRequired: number;
}

interface BaseMockBoard {
    _id: string;
    matrix: number[][];
    difficulty: string;
    createdAt: Date;
}

// Test Results Tracking
let testResults: TestResult[] = [];

describe('GameService', () => {
    let service: GameService;
    let mockBoardModel: Model<Board>;
    let mockGameModel: Model<Game>;
    let mockRedisService: jest.Mocked<RedisService>;
    let mockCacheManager: Cache;
    let mockRabbitMQService: jest.Mocked<RabbitMQService>;

    const mockGameData: BaseMockGame = {
        _id: 'test-game-123',
        boardId: 'test-board-123',
        currentState: [[1, 1, 0], [2, 2, 0], [0, 0, 0]],
        moves: [],
        lastMoveAt: new Date(),
        isSolved: false,
        minimumMovesRequired: 3
    };

    const mockBoardData: BaseMockBoard = {
        _id: 'test-board-123',
        matrix: [[1, 1, 0], [2, 2, 0], [0, 0, 0]],
        difficulty: 'medium',
        createdAt: new Date()
    };


    beforeEach(async () => {
        mockCacheManager = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            reset: jest.fn(),
        } as unknown as Cache;

        mockBoardModel = {
            create: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            findById: jest.fn(),
        } as unknown as Model<Board>;

        mockGameModel = {
            create: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            findById: jest.fn(),
        } as unknown as Model<Game>;

        mockRabbitMQService = {
            publishMoveEvent: jest.fn(),
            publishMoveAnalysis: jest.fn(),
            sendToQueue: jest.fn(),
            consume: jest.fn(),
            init: jest.fn(),
        } as unknown as jest.Mocked<RabbitMQService>;

        mockRedisService = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            getGame: jest.fn(),
            saveGame: jest.fn(),
            getAnalysisResult: jest.fn(),
            saveAnalysisResult: jest.fn(),
            setGame: jest.fn(),
            getClient: jest.fn(),
            client: jest.fn(),
            port: 6379
        } as unknown as jest.Mocked<RedisService>;

        // Set up default mock implementations
        (mockBoardModel.create as jest.Mock).mockImplementation((data) =>
            Promise.resolve({ ...mockBoardData, ...data }));
        (mockBoardModel.findById as jest.Mock).mockImplementation((id) =>
            Promise.resolve(id === mockBoardData._id ? mockBoardData : null));
        (mockBoardModel.find as jest.Mock).mockImplementation(() => ({
            exec: jest.fn().mockResolvedValue([mockBoardData])
        }));

        (mockGameModel.create as jest.Mock).mockImplementation((data) =>
            Promise.resolve({ ...mockGameData, ...data }));
        (mockGameModel.findById as jest.Mock).mockImplementation((id) =>
            Promise.resolve(id === mockGameData._id ? mockGameData : null));
        (mockGameModel.find as jest.Mock).mockImplementation(() => ({
            exec: jest.fn().mockResolvedValue([mockGameData])
        }));

        (mockRedisService.getGame as jest.Mock).mockResolvedValue(mockGameData);
        (mockRedisService.setGame as jest.Mock).mockResolvedValue(true);
        (mockRedisService.getAnalysisResult as jest.Mock).mockResolvedValue({
            totalMoves: 5,
            goodMoves: 3,
            wasteMoves: 1,
            blunders: 1,
            efficiency: 60,
            timeSpent: 300
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameService,
                {
                    provide: CACHE_MANAGER,
                    useValue: mockCacheManager,
                },
                {
                    provide: getModelToken(Board.name),
                    useValue: mockBoardModel,
                },
                {
                    provide: getModelToken(Game.name),
                    useValue: mockGameModel,
                },
                {
                    provide: RedisService,
                    useValue: mockRedisService,
                },
                {
                    provide: RabbitMQService,
                    useValue: mockRabbitMQService,
                },
            ],
        }).compile();

        service = module.get<GameService>(GameService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('moveCar', () => {
        it('should execute a valid move', async () => {
            const moveCarDto = {
                carId: 1,
                direction: MovementDirection.Right,
            };

            const result = await service.calcMoveQuality('test-game-123', moveCarDto);
            expect(result).toBeDefined();
            testResults.push({ category: 'Move Car', test: 'Valid move', passed: true });
        });
    });

    describe('getGame', () => {
        it('should return game details', async () => {
            const result = await service.getGame('test-game-123');

            expect(result).toBeDefined();
            expect(result).toMatchObject(mockGameData);
            expect(mockRedisService.getGame as jest.Mock).toHaveBeenCalledWith('test-game-123');
        });

        it('should throw NotFoundException for invalid game ID', async () => {
            (mockRedisService.getGame as jest.Mock).mockResolvedValueOnce(null);

            await expect(service.getGame('invalid-id'))
                .rejects.toThrow(NotFoundException);
        });
    });

    describe('getBoards', () => {
        it('should return boards list', async () => {
            const result = await service.getBoards('medium');

            expect(Array.isArray(result)).toBeTruthy();
            expect(mockBoardModel.find as jest.Mock).toHaveBeenCalled();
        });
    });

    describe('createBoard', () => {
        it('should create a new board', async () => {
            const matrix = [[1, 1, 0], [0, 0, 0], [0, 0, 0]];

            const result = await service.createBoard(matrix);

            expect(result).toBeDefined();
            expect(mockBoardModel.create as jest.Mock).toHaveBeenCalledWith({ matrix });
            expect(result).toMatchObject({
                ...mockBoardData,
                matrix
            });
        });
    });

    describe('startGame', () => {
        it('should start a new game', async () => {
            const result = await service.startGame('test-board-123');

            expect(result).toBeDefined();
            expect(mockBoardModel.findById as jest.Mock).toHaveBeenCalledWith('test-board-123');
            expect(mockGameModel.create as jest.Mock).toHaveBeenCalledWith(
                expect.objectContaining({
                    boardId: 'test-board-123',
                    currentState: mockBoardData.matrix,
                    moves: []
                })
            );
        });

        it('should throw error when board not found', async () => {
            (mockBoardModel.findById as jest.Mock).mockResolvedValueOnce(null);

            await expect(service.startGame('invalid-id'))
                .rejects.toThrow('Board not found');
        });
    });


    describe('getAnalysis', () => {
        it('should return game analysis', async () => {
            const result = await service.getAnalysis('test-game-123');

            expect(result).toBeDefined();
            expect(mockRedisService.getAnalysisResult as jest.Mock)
                .toHaveBeenCalledWith('test-game-123');
        });
    });

    // Test Summary Generator
    function generateTestSummary(results: TestResult[]): {
        categoryResults: { [key: string]: CategoryResult },
        overallSuccessRate: number
    } {
        const summary = {
            categoryResults: {} as { [key: string]: CategoryResult },
            overallSuccessRate: 0
        };

        results.forEach(result => {
            if (!summary.categoryResults[result.category]) {
                summary.categoryResults[result.category] = {
                    passed: 0,
                    failed: 0,
                    successRate: 0
                };
            }

            if (result.passed) {
                summary.categoryResults[result.category].passed++;
            } else {
                summary.categoryResults[result.category].failed++;
            }
        });

        let totalPassed = 0;
        let totalTests = 0;

        Object.values(summary.categoryResults).forEach(categoryResult => {
            const total = categoryResult.passed + categoryResult.failed;
            categoryResult.successRate = Math.round((categoryResult.passed / total) * 100);
            totalPassed += categoryResult.passed;
            totalTests += total;
        });

        summary.overallSuccessRate = Math.round((totalPassed / totalTests) * 100);

        return summary;
    }

    afterAll(() => {
        const summary = generateTestSummary(testResults);
        console.log('\nTest Summary:');
        console.log('=============');
        Object.entries(summary.categoryResults).forEach(([category, results]) => {
            console.log(`\n${category}:`);
            console.log(`Passed: ${results.passed}`);
            console.log(`Failed: ${results.failed}`);
            console.log(`Success Rate: ${results.successRate}%`);
        });
        console.log('\nOverall Success Rate:', summary.overallSuccessRate + '%');
    });
});
