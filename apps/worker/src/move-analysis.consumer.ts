import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { connect, Channel, Connection, ConsumeMessage } from 'amqplib';
import { ConfigService } from '@nestjs/config';
import { GameService } from '../../../shared/src/services/game.service';
import { exponentialBackoff } from '../../../shared/src/utils/retry';
import { RABBITMQ_QUEUE } from '../../../shared/src/constants/rabbitmq.constants';

interface MoveAnalysisEvent {
    type: string;
    gameId: string;
}

@Injectable()
export class MoveAnalysisConsumer implements OnModuleInit, OnModuleDestroy {
    private connection: Connection | null = null;
    private channel: Channel | null = null;
    private readonly logger = new Logger(MoveAnalysisConsumer.name);
    private readonly queueName = RABBITMQ_QUEUE.MOVE_ANALYSIS;
    private readonly dlxName = 'move-analysis.dlx'; // Changed from 'move-analysis-queue.dlx'
    private readonly dlqName = 'move-analysis.dlq'; // Changed for consistency
    private readonly retryOptions = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
    };

    constructor(
        private readonly gameService: GameService,
        private readonly configService: ConfigService,
    ) { }

    async onModuleInit() {
        await this.connectWithRetry();
    }

    async onModuleDestroy() {
        await this.cleanup();
    }

    private async connectWithRetry(): Promise<void> {
        try {
            await exponentialBackoff(
                async () => {
                    await this.setupRabbitMQ();
                    this.logger.log('Successfully connected to RabbitMQ');
                },
                this.retryOptions
            );
        } catch (error: unknown) {
            if (error instanceof Error) {
                this.logger.error('Failed to connect to RabbitMQ:', error.stack);
            }
            throw error;
        }
    }

    private async setupRabbitMQ(): Promise<void> {
        const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URI', 'amqp://rabbitmq:5672');
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

    private async setupChannelTopology(): Promise<void> {
        const channel = this.ensureChannel();

        // Setup Dead Letter Exchange
        await channel.assertExchange(this.dlxName, 'fanout', {
            durable: true
        });

        // Setup Dead Letter Queue
        await channel.assertQueue(this.dlqName, {
            durable: true
        });

        // Bind DLQ to DLX
        await channel.bindQueue(this.dlqName, this.dlxName, '');

        // Setup main queue with DLX configuration - removed routing key
        await channel.assertQueue(this.queueName, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': this.dlxName
                // Removed x-dead-letter-routing-key
            }
        });

        await channel.prefetch(1);
    }


    private async startConsumer(): Promise<void> {
        const channel = this.ensureChannel();
        await channel.consume(
            this.queueName,
            this.processMessage.bind(this),
            { noAck: false }
        );
    }

    private async processMessage(msg: ConsumeMessage | null): Promise<void> {
        if (!msg) return;

        const channel = this.ensureChannel();
        try {
            const event = this.parseMessage(msg);

            if (event.type !== 'CREATE_ANALYSIS') {
                this.logger.warn(`Unexpected event type: ${event.type}`);
                channel.ack(msg);
                return;
            }

            await this.processMessageWithRetry(event, msg);
        } catch (error) {
            this.logger.error('Failed to process message:', error instanceof Error ? error.stack : error);
            // Reject the message and send to DLQ
            channel.reject(msg, false);
        }
    }

    private parseMessage(msg: ConsumeMessage): MoveAnalysisEvent {
        try {
            return JSON.parse(msg.content.toString()) as MoveAnalysisEvent;
        } catch (error) {
            throw new Error('Invalid message format');
        }
    }

    private async processMessageWithRetry(
        event: MoveAnalysisEvent,
        msg: ConsumeMessage
    ): Promise<void> {
        await exponentialBackoff(
            async () => {
                await this.gameService.createAnalysisFromWorker(event.gameId);
                this.ensureChannel().ack(msg);
            },
            this.retryOptions
        );
    }

    private ensureChannel(): Channel {
        if (!this.channel) {
            throw new Error('RabbitMQ channel is not initialized');
        }
        return this.channel;
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
            await this.cleanup();
            await this.connectWithRetry();
        } catch (error: unknown) {
            if (error instanceof Error) {
                this.logger.error('Failed to reconnect:', error.stack);
            }
        }
    }

    private async cleanup(): Promise<void> {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }
        } catch (error) {
            this.logger.error('Error during cleanup:', error instanceof Error ? error.stack : error);
        }
    }
}
