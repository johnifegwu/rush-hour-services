import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { connect, Channel, Connection, ConsumeMessage } from 'amqplib';
import { GameService } from 'shared/src/services/game.service';
import { exponentialBackoff } from 'shared/src/utils/retry';

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
    private channel: Channel;
    private connection: Connection;
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

    constructor(private readonly gameService: GameService) { }

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
        } catch (error) {
            this.logger.error('Failed to connect to RabbitMQ after maximum retries:', error.stack);
            throw error;
        }
    }

    private async setupRabbitMQ(): Promise<void> {
        this.connection = await connect(process.env.RABBITMQ_URL, {
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

    private async setupChannelTopology(): Promise<void> {
        const { exchange, queue, routingKey, prefetchCount } = this.config;

        await this.channel.assertExchange(exchange, 'topic', {
            durable: true,
            autoDelete: false
        });

        await this.channel.assertQueue(queue, {
            durable: true,
            deadLetterExchange: `${exchange}.dlx`
        });

        await this.channel.assertExchange(`${exchange}.dlx`, 'topic', { durable: true });
        await this.channel.assertQueue(`${queue}.dlq`, { durable: true });
        await this.channel.bindQueue(`${queue}.dlq`, `${exchange}.dlx`, '#');

        await this.channel.bindQueue(queue, exchange, routingKey);
        await this.channel.prefetch(prefetchCount);
    }

    private async startConsumer(): Promise<void> {
        await this.channel.consume(
            this.config.queue,
            this.processMessage.bind(this),
            { noAck: false }
        );
    }

    private async processMessage(msg: ConsumeMessage | null): Promise<void> {
        if (!msg) return;

        try {
            const event: MoveAnalysisEvent = JSON.parse(msg.content.toString());

            if (event.type !== 'CREATE_ANALYSIS') {
                this.logger.warn(`Unexpected event type: ${event.type}`);
                this.channel.ack(msg);
                return;
            }

            await exponentialBackoff(
                async () => {
                    await this.gameService.createAnalysisFromWorker(event.gameId);
                    this.channel.ack(msg);
                },
                this.config.retryOptions
            );
        } catch (error) {
            this.logger.error('Failed to process message after retries:', error.stack);
            // Move to DLQ after max retries
            this.channel.nack(msg, false, false);
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
        } catch (error) {
            this.logger.error('Failed to reconnect:', error.stack);
        }
    }

    async onModuleDestroy() {
        try {
            await this.gracefulShutdown();
        } catch (error) {
            this.logger.error('Error during shutdown:', error.stack);
        }
    }

    private async gracefulShutdown(): Promise<void> {
        if (this.channel) {
            await this.channel.close();
        }
        if (this.connection) {
            await this.connection.close();
        }
    }
}
