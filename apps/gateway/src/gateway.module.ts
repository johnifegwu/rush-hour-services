import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { RabbitMQService, RedisService } from '../../../shared/src/services';

@Module({
    imports: [
        ConfigModule.forRoot(),
    ],
    controllers: [GatewayController],
    providers: [
        GatewayService,
        RabbitMQService,
        RedisService
    ],
})
export class GatewayModule {
    constructor(
        private readonly rabbitMQService: RabbitMQService,
        private readonly redisService: RedisService
    ) {
        // Initialize RabbitMQ
        this.rabbitMQService.init().catch(err => {
            console.error('Failed to initialize RabbitMQ:', err);
            throw err;
        });

        // Redis client is automatically initialized in the RedisService constructor
        // as seen in shared/src/services/redis.service.ts
    }
}
