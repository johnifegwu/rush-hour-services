import { Injectable } from '@nestjs/common';
import { connect, Connection, Channel } from 'amqplib';

@Injectable()
export class RabbitMQService {
    private connection: Connection;
    private channel: Channel;
    private port = process.env.RABBITMQ_PORT || 5672;

    async init() {
        this.connection = await connect(`amqp://rabbitmq:${this.port}`);
        this.channel = await this.connection.createChannel();
        await this.channel.assertQueue('move_quality_queue', { durable: false });
        await this.channel.assertQueue('move-analysis', { durable: true });
    }

    async publishMoveEvent(moveData: any) {
        if (!this.channel) {
            await this.init();
        }
        this.channel.sendToQueue(
            'move_quality_queue',
            Buffer.from(JSON.stringify(moveData))
        );
    }

    async publishMoveAnalysis(gameId: string, board: number[][], move: any) {
        if (!this.channel) {
            await this.init();
        }
        this.channel.sendToQueue(
            'move-analysis',
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
        // Set prefetch to 1 to ensure fair distribution of messages
        await this.channel.prefetch(1);

        // Assert the queue exists
        await this.channel.assertQueue(queueName, { durable: true });

        // Set up the consumer
        await this.channel.consume(queueName, async (message) => {
            if (message) {
                try {
                    // Parse the message content
                    const content = JSON.parse(message.content.toString());

                    // Execute the callback with the message content
                    await callback(content);

                    // Acknowledge the message after successful processing
                    this.channel.ack(message);
                } catch (error) {
                    // If there's an error processing the message
                    console.error('Error processing message:', error);

                    // Reject the message and requeue it
                    this.channel.nack(message, false, true);
                }
            }
        });
    }
}