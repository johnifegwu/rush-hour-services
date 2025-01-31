import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, Connection, Channel } from 'amqplib';
import { RABBITMQ_QUEUE } from '../../../shared/src/constants/rabbitmq.constants';

@Injectable()
export class RabbitMQService {
    private connection!: Connection;
    private channel!: Channel;

    constructor(private configService: ConfigService,
    ) { }

    async onModuleInit() {
        await this.init();
    }

    async init() {
        const constr = this.configService.get<string>('RABBITMQ_URI', 'amqp://rabbitmq:5672');
        this.connection = await connect(constr);
        this.channel = await this.connection.createChannel();
        // First, declare the dead letter exchanges
        await this.channel.assertExchange('move-quality.dlx', 'fanout', { durable: true });
        await this.channel.assertExchange('move-analysis.dlx', 'fanout', { durable: true });

        // Declare dead letter queues
        await this.channel.assertQueue('move-quality.dlq', { durable: true });
        await this.channel.assertQueue('move-analysis.dlq', { durable: true });

        // Bind dead letter queues to their exchanges
        await this.channel.bindQueue('move-quality.dlq', 'move-quality.dlx', '');
        await this.channel.bindQueue('move-analysis.dlq', 'move-analysis.dlx', '');

        // Declare main queues with dead letter configuration
        await this.channel.assertQueue(RABBITMQ_QUEUE.MOVE_QUALITY, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': 'move-quality.dlx'
            }
        });

        await this.channel.assertQueue(RABBITMQ_QUEUE.MOVE_ANALYSIS, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': 'move-analysis.dlx'
            }
        });
    }

    async publishMoveEvent(moveData: any) {
        if (!this.channel) {
            await this.init();
        }
        this.channel.sendToQueue(
            RABBITMQ_QUEUE.MOVE_QUALITY,
            Buffer.from(JSON.stringify(moveData))
        );
    }

    async publishMoveAnalysis(gameId: string, board: number[][], move: any) {
        if (!this.channel) {
            await this.init();
        }
        this.channel.sendToQueue(
            RABBITMQ_QUEUE.MOVE_ANALYSIS,
            Buffer.from(JSON.stringify({ gameId, board, move }))
        );
    }

    async sendToQueue<T>(queueName: string, data: T): Promise<boolean> {
        await this.channel.assertQueue(queueName, { durable: true });
        return this.channel.sendToQueue(
            queueName,
            Buffer.from(JSON.stringify(data))
        );
    }

    async consume(queueName: string, callback: (message: any) => Promise<void>): Promise<void> {
        await this.channel.prefetch(1);

        await this.channel.consume(queueName, async (message) => {
            if (message) {
                try {
                    const content = JSON.parse(message.content.toString());
                    await callback(content);
                    this.channel.ack(message);
                } catch (error) {
                    console.error('Error processing message:', error);
                    // Reject the message without requeuing
                    this.channel.reject(message, false);
                }
            }
        });
    }
}
