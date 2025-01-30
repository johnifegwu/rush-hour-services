import { Test, TestingModule } from '@nestjs/testing';
import { MoveQualityConsumer } from './move-quality.consumer';
import { GameService } from '../../../shared/src/services';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Connection, Channel, connect, ConsumeMessage } from 'amqplib';
import { MoveCarDto } from '../../../shared/src/dto/move-car.dto';
import { MovementDirection } from '../../../shared/src/interfaces/rush-hour.interface';

// Mock implementations
jest.mock('amqplib', () => ({
    connect: jest.fn(),
}));

describe('MoveQualityConsumer', () => {
    let consumer: MoveQualityConsumer;
    let gameService: jest.Mocked<GameService>;
    let configService: jest.Mocked<ConfigService>;
    let mockConnection: jest.Mocked<Connection>;
    let mockChannel: jest.Mocked<Channel>;
    let testResults: { passed: number; failed: number; total: number };

    beforeAll(() => {
        testResults = { passed: 0, failed: 0, total: 0 };
    });

    const setupConnection = async () => {
        configService.get.mockReturnValue('amqp://test:5672');
        await consumer.onModuleInit();
        (consumer as any).channel = mockChannel;
    };

    beforeEach(async () => {
        // Create mock implementations
        mockChannel = {
            assertQueue: jest.fn().mockResolvedValue(undefined),
            assertExchange: jest.fn().mockResolvedValue(undefined),
            bindQueue: jest.fn().mockResolvedValue(undefined),
            prefetch: jest.fn().mockResolvedValue(undefined),
            consume: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined),
            ack: jest.fn().mockResolvedValue(undefined),
            reject: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<Channel>;

        mockConnection = {
            createChannel: jest.fn().mockResolvedValue(mockChannel),
            close: jest.fn().mockResolvedValue(undefined),
            on: jest.fn(),
        } as unknown as jest.Mocked<Connection>;

        (connect as jest.Mock).mockResolvedValue(mockConnection);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MoveQualityConsumer,
                {
                    provide: GameService,
                    useValue: {
                        calcMoveQuality: jest.fn(),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn(),
                    },
                },
            ],
        }).compile();

        consumer = module.get<MoveQualityConsumer>(MoveQualityConsumer);
        gameService = module.get(GameService);
        configService = module.get(ConfigService);

        // Suppress console output during tests
        jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const runTest = async (testName: string, testFn: () => Promise<void>) => {
        testResults.total++;
        try {
            await testFn();
            testResults.passed++;
            console.log(`✅ ${testName} passed`);
        } catch (error) {
            testResults.failed++;
            console.error(`❌ ${testName} failed:`, error);
            throw error;
        }
    };

    it('should initialize properly', async () => {
        await runTest('Initialization', async () => {
            configService.get.mockReturnValue('amqp://test:5672');
            await consumer.onModuleInit();

            expect(connect).toHaveBeenCalledWith('amqp://test:5672');
            expect(mockConnection.createChannel).toHaveBeenCalled();
            expect(mockChannel.assertQueue).toHaveBeenCalled();
            expect(mockChannel.prefetch).toHaveBeenCalledWith(1);
        });
    });

    it('should handle connection errors', async () => {
        await runTest('Connection Error Handling', async () => {
            configService.get.mockReturnValue('amqp://test:5672');
            await consumer.onModuleInit();

            const errorCallback = mockConnection.on.mock.calls.find(
                call => call[0] === 'error'
            )?.[1];
            expect(errorCallback).toBeDefined();
        });
    });

    it('should process messages correctly', async () => {
        await runTest('Message Processing', async () => {
            await setupConnection();

            const mockMessage: ConsumeMessage = {
                content: Buffer.from(JSON.stringify({
                    gameId: 'test-game',
                    move: {
                        carId: 1,
                        direction: MovementDirection.Right
                    }
                })),
                properties: {} as any,
                fields: {} as any,
            };

            gameService.calcMoveQuality.mockResolvedValueOnce(undefined);

            await (consumer as any).processMessage(mockMessage);

            expect(gameService.calcMoveQuality).toHaveBeenCalledWith(
                'test-game',
                {
                    carId: 1,
                    direction: MovementDirection.Right
                }
            );
            expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
        });
    });

    it('should handle message processing errors', async () => {
        await runTest('Error Handling', async () => {
            await setupConnection();

            const mockMessage: ConsumeMessage = {
                content: Buffer.from('invalid json'),
                properties: {} as any,
                fields: {} as any,
            };

            await (consumer as any).processMessage(mockMessage);

            expect(mockChannel.reject).toHaveBeenCalledWith(mockMessage, false);
        });
    });

    it('should clean up resources on module destroy', async () => {
        await runTest('Cleanup', async () => {
            await consumer.onModuleInit();
            await consumer.onModuleDestroy();

            expect(mockChannel.close).toHaveBeenCalled();
            expect(mockConnection.close).toHaveBeenCalled();
        });
    });

    afterAll(() => {
        console.log('\nTest Summary:');
        console.log('=============');
        console.log(`Total Tests: ${testResults.total}`);
        console.log(`Passed: ${testResults.passed}`);
        console.log(`Failed: ${testResults.failed}`);
        console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
    });
});
