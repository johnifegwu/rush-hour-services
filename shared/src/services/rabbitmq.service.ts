import { Injectable } from '@nestjs/common';
import { connect, Connection, Channel } from 'amqplib';

@Injectable()
export class RabbitMQService {
    private connection: Connection;
    private channel: Channel;

    async init() {
        this.connection = await connect('amqp://rabbitmq:5672');
        this.channel = await this.connection.createChannel();
        await this.channel.assertQueue('move-analysis', { durable: true });
    }

    async publishMoveAnalysis(gameId: string, board: number[][], move: any) {
        await this.channel.sendToQueue(
            'move-analysis',
            Buffer.from(JSON.stringify({ gameId, board, move }))
        );
    }
}