import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RabbitMQService implements OnModuleInit {
    private channelWrapper: any;

    constructor(private configService: ConfigService) { }

    async onModuleInit() {
        const connection = amqp.connect([this.configService.getOrThrow('rabbitmq.uri')]);

        this.channelWrapper = connection.createChannel({
            setup: (channel) => {
                return Promise.all([
                    channel.assertQueue(this.configService.get('rabbitmq.queues.moveAnalysis'), {
                        durable: true,
                    }),
                ]);
            },
        });
    }

    async publishMoveAnalysis(data: any) {
        return this.channelWrapper.sendToQueue(
            this.configService.get('rabbitmq.queues.moveAnalysis'),
            Buffer.from(JSON.stringify(data)),
            { persistent: true }
        );
    }
}