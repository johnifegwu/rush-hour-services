import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { connect, Channel, Connection, ConsumeMessage } from 'amqplib';
import { ConfigService } from '@nestjs/config';
import { GameService } from '../../../shared/src/services/game.service';
import { exponentialBackoff } from '../../../shared/src/utils/retry';

interface MoveAnalysisEvent {
    type: string;
    gameId: string;
}

interface RabbitMQConfig {
    exchange: string;
    queue: string;
    routingKey: string;
    prefetchCount: number;
    retryOptions: {
        maxRetries: number;
        initialDelay: number;
        maxDelay: number;
    };
}

@Injectable()
export class MoveAnalysisConsumer implements OnModuleInit, OnModuleDestroy {
    private connection: Connection | null = null;
    private channel: Channel | null = null;
    private readonly logger = new Logger(MoveAnalysisConsumer.name);
    private readonly config: RabbitMQConfig = {
        exchange: 'moves',
        queue: 'move-analysis-queue',
        routingKey: 'move.analysis',
        prefetchCount: 1,
        retryOptions: {
            maxRetries: 3,
            initialDelay: 1000, // 1 second
            maxDelay: 10000, // 10 seconds
        }
    };

    constructor(private readonly gameService: GameService,
        private readonly configService: ConfigService,
    ) { }

    async onModuleInit() {
        await this.connectWithRetry();
    }

    private async connectWithRetry(): Promise<void> {
        try {
            await exponentialBackoff(
                async () => {
                    await this.setupRabbitMQ();
                    this.logger.log('Successfully connected to RabbitMQ');
                },
                this.config.retryOptions
            );
        } catch (error: unknown) {
            if (error instanceof Error) {
                this.logger.error('Failed to connect to RabbitMQ:', error.stack);
            }
            throw error;
        }
    }

    private async setupRabbitMQ(): Promise<void> {
        const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URL') ?? 'redis://redis:6379';
        this.connection = await connect(rabbitmqUrl, {
            clientProperties: {
                connection_name: 'move-analysis-consumer'
            },
            heartbeat: 60
        });

        this.connection.on('error', this.handleConnectionError.bind(this));
        this.connection.on('close', this.handleConnectionClose.bind(this));

        this.channel = await this.connection.createChannel();
        await this.setupChannelTopology();
        await this.startConsumer();
    }

    private ensureChannel(): Channel {
        if (!this.channel) {
            throw new Error('RabbitMQ channel is not initialized');
        }
        return this.channel;
    }

    private async setupChannelTopology(): Promise<void> {
        const channel = this.ensureChannel();
        const { exchange, queue, routingKey, prefetchCount } = this.config;

        await channel.assertExchange(exchange, 'topic', {
            durable: true,
            autoDelete: false
        });

        await channel.assertQueue(queue, {
            durable: true,
            deadLetterExchange: `${exchange}.dlx`
        });

        await channel.assertExchange(`${exchange}.dlx`, 'topic', { durable: true });
        await channel.assertQueue(`${queue}.dlq`, { durable: true });
        await channel.bindQueue(`${queue}.dlq`, `${exchange}.dlx`, '#');

        await channel.bindQueue(queue, exchange, routingKey);
        await channel.prefetch(prefetchCount);
    }

    private async startConsumer(): Promise<void> {
        const channel = this.ensureChannel();
        await channel.consume(
            this.config.queue,
            this.processMessage.bind(this),
            { noAck: false }
        );
    }

    private async processMessage(msg: ConsumeMessage | null): Promise<void> {
        if (!msg) return;

        const channel = this.ensureChannel();
        try {
            const event: MoveAnalysisEvent = JSON.parse(msg.content.toString());

            if (event.type !== 'CREATE_ANALYSIS') {
                this.logger.warn(`Unexpected event type: ${event.type}`);
                channel.ack(msg);
                return;
            }

            await exponentialBackoff(
                async () => {
                    await this.gameService.createAnalysisFromWorker(event.gameId);
                    channel.ack(msg);
                },
                this.config.retryOptions
            );
        } catch (error) {
            this.logger.error('Failed to process message after retries:', error instanceof Error ? error.stack : error);
            // Move to DLQ after max retries
            channel.nack(msg, false, false);
        }
    }

    private async handleConnectionError(error: Error): Promise<void> {
        this.logger.error('RabbitMQ connection error:', error.stack);
        await this.reconnect();
    }

    private async handleConnectionClose(): Promise<void> {
        this.logger.warn('RabbitMQ connection closed');
        await this.reconnect();
    }

    private async reconnect(): Promise<void> {
        try {
            await this.connectWithRetry();
        } catch (error: unknown) {
            if (error instanceof Error) {
                this.logger.error('Failed to reconnect:', error.stack);
            }
        }
    }

    async onModuleDestroy() {
        try {
            await this.gracefulShutdown();
        } catch (error: unknown) {
            if (error instanceof Error) {
                this.logger.error('Error during graceful shutdown:', error.stack);
            }
        }
    }

    private async gracefulShutdown(): Promise<void> {
        if (this.channel) {
            await this.channel.close();
            this.channel = null;
        }
        if (this.connection) {
            await this.connection.close();
            this.connection = null;
        }
    }
}
