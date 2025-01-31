import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { MoveAnalysisConsumer } from './move-analysis.consumer';
import { GameService } from '../../../shared/src/services/game.service';
import { Connection, Channel, connect } from 'amqplib';
import { TestResults } from './interfaces/test-results.interface';
import { RABBITMQ_QUEUE } from '../../../shared/src/constants/rabbitmq.constants';

// Mock implementations
jest.mock('amqplib');
jest.mock('../../../shared/src/services/game.service');

describe('MoveAnalysisConsumer', () => {
    let consumer: MoveAnalysisConsumer;
    let configService: ConfigService;
    let gameService: jest.Mocked<GameService>;
    let mockConnection: jest.Mocked<Connection>;
    let mockChannel: jest.Mocked<Channel>;
    let testResults: TestResults = {
        passed: 0,
        failed: 0,
        total: 0
    };

    beforeEach(async () => {
        // Reset mocks
        mockChannel = {
            assertExchange: jest.fn().mockResolvedValue(undefined),
            assertQueue: jest.fn().mockResolvedValue(undefined),
            bindQueue: jest.fn().mockResolvedValue(undefined),
            prefetch: jest.fn().mockResolvedValue(undefined),
            consume: jest.fn().mockResolvedValue(undefined),
            ack: jest.fn().mockResolvedValue(undefined),
            nack: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<Channel>;

        mockConnection = {
            createChannel: jest.fn().mockResolvedValue(mockChannel),
            on: jest.fn(),
            close: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<Connection>;

        (connect as jest.Mock).mockResolvedValue(mockConnection);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MoveAnalysisConsumer,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockReturnValue('amqp://localhost'),
                    },
                },
                {
                    provide: GameService,
                    useValue: {
                        createAnalysisFromWorker: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        }).compile();

        consumer = module.get<MoveAnalysisConsumer>(MoveAnalysisConsumer);
        configService = module.get<ConfigService>(ConfigService);
        gameService = module.get<GameService>(GameService) as jest.Mocked<GameService>;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });



    afterAll(() => {
        console.log('\nTest Results Summary:');
        console.log(`Total Tests: ${testResults.total}`);
        console.log(`Passed: ${testResults.passed}`);
        console.log(`Failed: ${testResults.failed}`);
    });

    const runTest = async (testName: string, testFn: () => Promise<void>) => {
        testResults.total++;
        try {
            await testFn();
            testResults.passed++;
            console.log(`✓ ${testName}`);
        } catch (error) {
            testResults.failed++;
            console.error(`✗ ${testName}`);
            throw error;
        }
    };

    it('should initialize properly', async () => {
        await runTest('Initialization test', async () => {
            await consumer.onModuleInit();
            expect(connect).toHaveBeenCalled();
            expect(mockConnection.createChannel).toHaveBeenCalled();
        });
    });

    it('should setup channel topology correctly', async () => {
        await runTest('Channel topology setup test', async () => {
            await consumer.onModuleInit();
            expect(mockChannel.assertExchange).toHaveBeenCalledWith('moves', 'topic', expect.any(Object));
            expect(mockChannel.assertQueue).toHaveBeenCalledWith(RABBITMQ_QUEUE.MOVE_ANALYSIS, expect.any(Object));
            expect(mockChannel.bindQueue).toHaveBeenCalled();
        });
    });

    it('should process valid messages correctly', async () => {
        await runTest('Message processing test', async () => {
            const mockMessage = {
                content: Buffer.from(JSON.stringify({
                    type: 'CREATE_ANALYSIS',
                    gameId: '123'
                })),
            };

            await consumer.onModuleInit();
            const consumeCallback = mockChannel.consume.mock.calls[0][1];
            consumeCallback(mockMessage as any);

            expect(gameService.createAnalysisFromWorker).toHaveBeenCalledWith('123');
            expect(mockChannel.ack).toHaveBeenCalled();
        });
    });

    it('should handle invalid message types appropriately', async () => {
        await runTest('Invalid message type test', async () => {
            const mockMessage = {
                content: Buffer.from(JSON.stringify({
                    type: 'INVALID_TYPE',
                    gameId: '123'
                })),
            };

            await consumer.onModuleInit();
            const consumeCallback = mockChannel.consume.mock.calls[0][1];
            consumeCallback(mockMessage as any);

            expect(gameService.createAnalysisFromWorker).not.toHaveBeenCalled();
            expect(mockChannel.ack).toHaveBeenCalled();
        });
    });
    it('should handle message processing errors correctly', async () => {
        // Increase the timeout for this specific test
        jest.setTimeout(10000);

        await runTest('Error handling test', async () => {
            // Mock the error
            gameService.createAnalysisFromWorker.mockRejectedValue(new Error('Processing failed'));

            const mockMessage = {
                content: Buffer.from(JSON.stringify({
                    type: 'CREATE_ANALYSIS',
                    gameId: '123'
                })),
            };

            // Mock the exponential backoff to avoid actual delays
            const mockSetTimeout = jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
                cb();
                return {} as any;
            });

            await consumer.onModuleInit();
            const consumeCallback = mockChannel.consume.mock.calls[0][1];

            // Wait for the message processing to complete
            await consumeCallback(mockMessage as any);

            // Add a small delay to ensure error handling completes
            await new Promise(resolve => process.nextTick(resolve));

            // Verify that nack was called with the correct parameters
            expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);

            // Clean up the setTimeout mock
            mockSetTimeout.mockRestore();
        });
    }, 10000);


    it('should perform graceful shutdown', async () => {
        await runTest('Graceful shutdown test', async () => {
            await consumer.onModuleInit();
            await consumer.onModuleDestroy();

            expect(mockChannel.close).toHaveBeenCalled();
            expect(mockConnection.close).toHaveBeenCalled();
        });
    });
});
