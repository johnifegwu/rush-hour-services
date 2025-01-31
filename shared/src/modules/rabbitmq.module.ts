import { Module } from '@nestjs/common';
import { RabbitMQService } from '../services/rabbitmq.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [ConfigModule],
    providers: [
        RabbitMQService,
        ConfigService
    ],
    exports: [RabbitMQService]
})
export class RabbitMQModule { }