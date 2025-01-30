import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { connect, Connection, Channel, ConsumeMessage } from 'amqplib';
import { GameService } from '../../../shared/src/services';
import { ConfigService } from '@nestjs/config';
import { exponentialBackoff } from '../../../shared/src/utils/retry';
import { MoveCarDto } from '../../../shared/src/dto/move-car.dto';

interface MoveQualityMessage {
    gameId: string;
    move: MoveCarDto;
}

@Injectable()
export class MoveQualityConsumer implements OnModuleInit, OnModuleDestroy {
    private connection: Connection | null = null;
    private channel: Channel | null = null;
    private readonly logger = new Logger(MoveQualityConsumer.name);
    private readonly maxRetries = 3;
    private readonly queueName = 'move_quality_queue';

    constructor(
        private readonly gameService: GameService,
        private readonly configService: ConfigService,
    ) { }

    async onModuleInit(): Promise<void> {
        await this.setupConnection();
    }

    async onModuleDestroy(): Promise<void> {
        await this.cleanup();
    }

    private async setupConnection(): Promise<void> {
        try {
            const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URL') || 'amqp://rabbitmq:5672';
            this.connection = await this.connectWithRetry(rabbitmqUrl);
            this.channel = await this.connection.createChannel();

            // Make queue durable and enable message persistence
            await this.channel.assertQueue(this.queueName, {
                durable: true,
                deadLetterExchange: 'dlx',
                deadLetterRoutingKey: `${this.queueName}.dlq`
            });

            // Setup Dead Letter Queue
            await this.setupDeadLetterQueue();

            // Prefetch for better load balancing
            await this.channel.prefetch(1);

            this.logger.log(`Waiting for messages in ${this.queueName}`);
            await this.startConsumer();

            // Setup connection error handlers
            this.handleConnectionEvents();
        } catch (error) {
            this.logger.error('Failed to setup RabbitMQ connection:', error);
            throw error;
        }
    }

    private async connectWithRetry(url: string): Promise<Connection> {
        return exponentialBackoff(
            async () => await connect(url),
            {
                maxRetries: 5,
                initialDelay: 1000,
                maxDelay: 10000,
            }
        );
    }

    private async setupDeadLetterQueue(): Promise<void> {
        if (!this.channel) return;

        await this.channel.assertExchange('dlx', 'direct', { durable: true });
        await this.channel.assertQueue(`${this.queueName}.dlq`, { durable: true });
        await this.channel.bindQueue(
            `${this.queueName}.dlq`,
            'dlx',
            `${this.queueName}.dlq`
        );
    }

    private handleConnectionEvents(): void {
        if (this.connection) {
            this.connection.on('error', (error) => {
                this.logger.error('RabbitMQ connection error:', error);
                this.attemptReconnect();
            });

            this.connection.on('close', () => {
                this.logger.warn('RabbitMQ connection closed');
                this.attemptReconnect();
            });
        }
    }

    private async startConsumer(): Promise<void> {
        if (!this.channel) return;

        await this.channel.consume(
            this.queueName,
            async (msg) => await this.processMessage(msg),
            { noAck: false }
        );
    }

    private async processMessage(msg: ConsumeMessage | null): Promise<void> {
        if (!msg || !this.channel) return;

        try {
            const moveData = this.parseMessage(msg);
            await this.processMessageWithRetry(moveData, msg);
        } catch (error) {
            this.logger.error('Error processing message:', error);
            // Send to Dead Letter Queue after max retries
            this.channel.reject(msg, false);
        }
    }

    private parseMessage(msg: ConsumeMessage): MoveQualityMessage {
        try {
            return JSON.parse(msg.content.toString()) as MoveQualityMessage;
        } catch (error) {
            throw new Error('Invalid message format');
        }
    }

    private async processMessageWithRetry(
        moveData: MoveQualityMessage,
        msg: ConsumeMessage
    ): Promise<void> {
        let attempts = 0;

        while (attempts < this.maxRetries) {
            try {
                await this.gameService.calcMoveQuality(
                    moveData.gameId,
                    moveData.move
                );

                this.channel?.ack(msg);
                return;
            } catch (error) {
                attempts++;
                this.logger.warn(
                    `Attempt ${attempts} failed for message ${msg.content.toString()}`
                );

                if (attempts === this.maxRetries) {
                    throw error;
                }

                await new Promise(resolve =>
                    setTimeout(resolve, Math.pow(2, attempts) * 1000)
                );
            }
        }
    }

    private async attemptReconnect(): Promise<void> {
        await this.cleanup();
        await this.setupConnection();
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
            this.logger.error('Error during cleanup:', error);
        }
    }
}
