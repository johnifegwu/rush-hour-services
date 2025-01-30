import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import TransformInterceptor from './interceptors/transform.interceptor'; // Updated import
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RedisService } from '../../../shared/src/services/redis.service';

@Module({
    imports: [
        HttpModule.register({
            timeout: 5000,
            maxRedirects: 5,
        }),
    ],
    controllers: [GatewayController],
    providers: [
        GatewayService,
        RedisService,
        {
            provide: APP_INTERCEPTOR,
            useClass: LoggingInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: TransformInterceptor,
        },
        {
            provide: APP_GUARD,
            useClass: RateLimitGuard,
        },
    ],
})
export class GatewayModule { }