// cleanup.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CleanupService } from './cleanup.service';
import { Game } from '../../../../shared/src/schemas/game.schema';
import { RedisService } from '../../../../shared/src/services/redis.service';

interface TestResult {
    category: string;
    testName: string;
    passed: boolean;
    error?: string;
}

class TestSummary {
    private readonly results: TestResult[] = [];

    addResult(result: TestResult) {
        this.results.push(result);
    }

    printSummary() {
        const categories = [...new Set(this.results.map(r => r.category))];

        console.log('\nTest Summary');
        console.log('============');

        let totalPassed = 0;
        let totalFailed = 0;

        categories.forEach(category => {
            const categoryTests = this.results.filter(r => r.category === category);
            const passed = categoryTests.filter(t => t.passed).length;
            const failed = categoryTests.filter(t => !t.passed).length;

            console.log(`\n${category}`);
            console.log(`Passed: ${passed}`);
            console.log(`Failed: ${failed}`);

            totalPassed += passed;
            totalFailed += failed;
        });

        console.log('\nOverall Results');
        console.log('===============');
        console.log(`Total Tests: ${this.results.length}`);
        console.log(`Passed: ${totalPassed}`);
        console.log(`Failed: ${totalFailed}`);
        console.log(`Success Rate: ${Math.round((totalPassed / this.results.length) * 100)}%`);

        // Print failed tests if any
        const failedTests = this.results.filter(r => !r.passed);
        if (failedTests.length > 0) {
            console.log('\nFailed Tests');
            console.log('============');
            failedTests.forEach(test => {
                console.log(`${test.category} - ${test.testName}`);
                if (test.error) console.log(`Error: ${test.error}`);
            });
        }
    }
}

describe('CleanupService', () => {
    let service: CleanupService;
    let mockGameModel: Model<Game>;
    let mockRedisService: jest.Mocked<RedisService>;
    let testSummary: TestSummary;

    const mockGames = [
        {
            id: '1',
            lastMoveAt: new Date(Date.now() - 6 * 60 * 1000),
        },
        {
            id: '2',
            lastMoveAt: new Date(Date.now() - 7 * 60 * 1000),
        },
    ];

    beforeEach(async () => {
        testSummary = new TestSummary();

        mockGameModel = {
            find: jest.fn(),
            deleteMany: jest.fn(),
        } as unknown as Model<Game>;

        mockRedisService = {
            deleteGame: jest.fn(),
        } as unknown as jest.Mocked<RedisService>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CleanupService,
                {
                    provide: getModelToken(Game.name),
                    useValue: mockGameModel,
                },
                {
                    provide: RedisService,
                    useValue: mockRedisService,
                },
            ],
        }).compile();

        service = module.get<CleanupService>(CleanupService);
    });

    describe('handleGameCleanup', () => {
        it('should successfully cleanup inactive games', async () => {
            try {
                (mockGameModel.find as jest.Mock).mockResolvedValue(mockGames);
                (mockGameModel.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 2 });
                (mockRedisService.deleteGame as jest.Mock).mockResolvedValue(true);

                const result = await service.handleGameCleanup();

                expect(result.success).toBe(true);
                expect(result.gamesDeleted).toBe(2);
                expect(result.redisKeysDeleted).toBe(2);
                expect(mockGameModel.find).toHaveBeenCalled();
                expect(mockGameModel.deleteMany).toHaveBeenCalled();
                expect(mockRedisService.deleteGame).toHaveBeenCalledTimes(2);

                testSummary.addResult({
                    category: 'Cleanup',
                    testName: 'Successfully cleanup inactive games',
                    passed: true
                });
            } catch (error) {
                testSummary.addResult({
                    category: 'Cleanup',
                    testName: 'Successfully cleanup inactive games',
                    passed: false,
                    error: error.message
                });
                throw error;
            }
        });

        it('should handle database errors gracefully', async () => {
            try {
                (mockGameModel.find as jest.Mock).mockRejectedValue(new Error('DB Error'));

                const result = await service.handleGameCleanup();

                expect(result.success).toBe(false);
                expect(result.error).toBe('DB Error');
                expect(result.gamesDeleted).toBe(0);

                testSummary.addResult({
                    category: 'Error Handling',
                    testName: 'Handle database errors',
                    passed: true
                });
            } catch (error) {
                testSummary.addResult({
                    category: 'Error Handling',
                    testName: 'Handle database errors',
                    passed: false,
                    error: error.message
                });
                throw error;
            }
        });

        it('should handle Redis errors gracefully', async () => {
            try {
                (mockGameModel.find as jest.Mock).mockResolvedValue(mockGames);
                (mockRedisService.deleteGame as jest.Mock).mockRejectedValue(new Error('Redis Error'));

                const result = await service.handleGameCleanup();

                expect(result.success).toBe(false);
                expect(result.error).toBe('Redis Error');

                testSummary.addResult({
                    category: 'Error Handling',
                    testName: 'Handle Redis errors',
                    passed: true
                });
            } catch (error) {
                testSummary.addResult({
                    category: 'Error Handling',
                    testName: 'Handle Redis errors',
                    passed: false,
                    error: error.message
                });
                throw error;
            }
        });

        it('should handle empty game list', async () => {
            try {
                (mockGameModel.find as jest.Mock).mockResolvedValue([]);
                (mockGameModel.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 0 });

                const result = await service.handleGameCleanup();

                expect(result.success).toBe(true);
                expect(result.gamesDeleted).toBe(0);
                expect(result.redisKeysDeleted).toBe(0);

                testSummary.addResult({
                    category: 'Cleanup',
                    testName: 'Handle empty game list',
                    passed: true
                });
            } catch (error) {
                testSummary.addResult({
                    category: 'Cleanup',
                    testName: 'Handle empty game list',
                    passed: false,
                    error: error.message
                });
                throw error;
            }
        });
    });

    describe('getCleanupSummary', () => {
        it('should return all cleanup history', async () => {
            try {
                await service.handleGameCleanup();
                await service.handleGameCleanup();

                const summary = service.getCleanupSummary();
                expect(summary).toHaveLength(2);

                testSummary.addResult({
                    category: 'Summary',
                    testName: 'Return all cleanup history',
                    passed: true
                });
            } catch (error) {
                testSummary.addResult({
                    category: 'Summary',
                    testName: 'Return all cleanup history',
                    passed: false,
                    error: error.message
                });
                throw error;
            }
        });

        it('should return limited cleanup history', async () => {
            try {
                await service.handleGameCleanup();
                await service.handleGameCleanup();
                await service.handleGameCleanup();

                const summary = service.getCleanupSummary(2);
                expect(summary).toHaveLength(2);

                testSummary.addResult({
                    category: 'Summary',
                    testName: 'Return limited cleanup history',
                    passed: true
                });
            } catch (error) {
                testSummary.addResult({
                    category: 'Summary',
                    testName: 'Return limited cleanup history',
                    passed: false,
                    error: error.message
                });
                throw error;
            }
        });
    });

    describe('clearHistory', () => {
        it('should clear cleanup history', async () => {
            try {
                await service.handleGameCleanup();
                await service.handleGameCleanup();

                service.clearHistory();
                const summary = service.getCleanupSummary();
                expect(summary).toHaveLength(0);

                testSummary.addResult({
                    category: 'History',
                    testName: 'Clear cleanup history',
                    passed: true
                });
            } catch (error) {
                testSummary.addResult({
                    category: 'History',
                    testName: 'Clear cleanup history',
                    passed: false,
                    error: error.message
                });
                throw error;
            }
        });
    });

    afterAll(() => {
        testSummary.printSummary();
    });
});
