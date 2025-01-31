import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQService } from '../services';

@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: 'RABBITMQ_SERVICE',
                imports: [ConfigModule],
                useFactory: async (configService: ConfigService) => ({
                    transport: Transport.RMQ,
                    options: {
                        urls: [configService.get<string>('RABBITMQ_URI', 'amqp://rabbitmq:5672')],
                        queue: configService.get<string>('RABBITMQ_QUEUE', 'default_queue'),
                        queueOptions: {
                            durable: true,
                            arguments: {
                                'x-dead-letter-exchange': `${configService.get<string>('RABBITMQ_QUEUE', 'default_queue')}.dlx`,
                                // Remove'x-dead-letter-routing-key': `${configService.get<string>('RABBITMQ_QUEUE', 'default_queue')}.dlq`
                            }
                        },
                        retry: {
                            retries: 5,
                            factor: 2,
                            minTimeout: 1000,
                            maxTimeout: 10000,
                        },
                        reconnectAttempts: 5,
                        reconnectTimeInSeconds: 5,
                        socketOptions: {
                            heartbeatIntervalInSeconds: 30,
                        },
                        prefetchCount: 1,
                        noAck: false,
                        exchanges: [
                            {
                                name: `${configService.get<string>('RABBITMQ_QUEUE', 'default_queue')}.dlx`,
                                type: 'fanout',
                            },
                        ],
                        queues: [
                            {
                                name: `${configService.get<string>('RABBITMQ_QUEUE', 'default_queue')}.dlq`,
                                durable: true,
                                bindings: [
                                    {
                                        exchange: `${configService.get<string>('RABBITMQ_QUEUE', 'default_queue')}.dlx`,
                                        // Remove routingKey: '',
                                    },
                                ],
                            },
                        ],
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    providers: [
        RabbitMQService,
        ConfigService
    ],
    exports: [ClientsModule, RabbitMQService],
})
export class RabbitMQModule { }
