import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from './game.service';
import { Model, Document } from 'mongoose';
import { RedisService } from './redis.service';
import { Board } from '../schemas/board.schema';
import { Game } from '../schemas/game.schema';
import { NotFoundException } from '@nestjs/common';
import {
    MovementDirection,
    MoveQuality,
    GameMove,
    AnalysisResult
} from '../interfaces/rush-hour.interface';

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

// Define interfaces for mocking
interface MockGame extends Partial<Document> {
    _id: string;
    boardId: string;
    currentState: number[][];
    moves: GameMove[];
    lastMoveAt: Date;
    isSolved: boolean;
    minimumMovesRequired: number;
}

interface MockBoard extends Partial<Document> {
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

    const mockGame: MockGame = {
        _id: 'test-game-123',
        boardId: 'test-board-123',
        currentState: [[1, 1, 0], [2, 2, 0], [0, 0, 0]],
        moves: [],
        lastMoveAt: new Date(),
        isSolved: false,
        minimumMovesRequired: 3,
        // Add minimal Document interface implementations
        $assertPopulated: jest.fn(),
        $clearModifiedPaths: jest.fn(),
        $clone: jest.fn(),
        toJSON: jest.fn()
    };

    const mockBoard: MockBoard = {
        _id: 'test-board-123',
        matrix: [[1, 1, 0], [2, 2, 0], [0, 0, 0]],
        difficulty: 'medium',
        createdAt: new Date(),
        // Add minimal Document interface implementations
        $assertPopulated: jest.fn(),
        $clearModifiedPaths: jest.fn(),
        $clone: jest.fn(),
        toJSON: jest.fn()
    };

    beforeEach(async () => {
        // Create mock implementations with proper typing
        const mockRedisImplementation: Partial<RedisService> = {
            getClient: jest.fn(),
            getGame: jest.fn(),
            setGame: jest.fn(),
            get: jest.fn(),
            set: jest.fn(),
            getAnalysisResult: jest.fn(),
            saveAnalysisResult: jest.fn(),
            del: jest.fn(),
            disconnect: jest.fn()
        };

        mockRedisService = mockRedisImplementation as jest.Mocked<RedisService>;

        // Set up mock implementations
        mockRedisService.getGame.mockResolvedValue(mockGame as unknown as Game);
        mockRedisService.setGame.mockResolvedValue();
        mockRedisService.get.mockResolvedValue(null);
        mockRedisService.set.mockResolvedValue();
        mockRedisService.getAnalysisResult.mockResolvedValue(null);
        mockRedisService.saveAnalysisResult.mockResolvedValue();
        mockRedisService.del.mockResolvedValue();
        mockRedisService.disconnect.mockResolvedValue();

        mockBoardModel = {
            findById: jest.fn().mockReturnThis(),
            find: jest.fn().mockReturnThis(),
            create: jest.fn().mockResolvedValue(mockBoard),
            findOne: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(mockBoard)
        } as unknown as Model<Board>;

        mockGameModel = {
            create: jest.fn().mockResolvedValue(mockGame),
            findById: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(mockGame)
        } as unknown as Model<Game>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameService,
                {
                    provide: 'BoardModel',
                    useValue: mockBoardModel,
                },
                {
                    provide: 'GameModel',
                    useValue: mockGameModel,
                },
                {
                    provide: RedisService,
                    useValue: mockRedisService,
                },
            ],
        }).compile();

        service = module.get<GameService>(GameService);
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
            mockRedisService.getGame.mockResolvedValue(mockGame);

            const result = await service.getGame('test-game-123');
            expect(result).toBeDefined();
            expect(result).toEqual(mockGame);
            testResults.push({ category: 'Game Retrieval', test: 'Get game', passed: true });
        });

        it('should throw NotFoundException for invalid game ID', async () => {
            mockRedisService.getGame.mockResolvedValue(null);

            await expect(service.getGame('invalid-id'))
                .rejects.toThrow(NotFoundException);
            testResults.push({ category: 'Error Handling', test: 'Invalid game ID', passed: true });
        });
    });

    describe('getBoards', () => {
        it('should return boards list', async () => {
            (mockBoardModel.find as jest.Mock).mockImplementation(() => ({
                exec: jest.fn().mockResolvedValue([mockBoard])
            }));

            const result = await service.getBoards('medium');
            expect(Array.isArray(result)).toBeTruthy();
            testResults.push({ category: 'Board Retrieval', test: 'Get boards', passed: true });
        });
    });

    describe('createBoard', () => {
        it('should create a new board', async () => {
            const matrix = [[1, 1, 0], [0, 0, 0], [0, 0, 0]];
            const result = await service.createBoard(matrix);
            expect(result).toBeDefined();
            expect(mockBoardModel.create).toHaveBeenCalled();
            testResults.push({ category: 'Board Creation', test: 'Create board', passed: true });
        });
    });

    describe('startGame', () => {
        it('should start a new game', async () => {
            const result = await service.startGame('test-board-123');
            expect(result).toBeDefined();
            expect(mockGameModel.create).toHaveBeenCalled();
            testResults.push({ category: 'Game Start', test: 'Start new game', passed: true });
        });
    });

    describe('getAnalysis', () => {
        it('should return game analysis', async () => {
            const mockAnalysis: AnalysisResult = {
                totalMoves: 5,
                goodMoves: 3,
                wasteMoves: 1,
                blunders: 1,
                efficiency: 60,
                timeSpent: 300
            };
            mockRedisService.getAnalysisResult.mockResolvedValue(mockAnalysis);

            const result = await service.getAnalysis('test-game-123');
            expect(result).toEqual(mockAnalysis);
            testResults.push({ category: 'Analysis', test: 'Get analysis', passed: true });
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
