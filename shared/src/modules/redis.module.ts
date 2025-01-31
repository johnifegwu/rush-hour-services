import { Module } from '@nestjs/common';
import { RedisService } from '../services/redis.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport, RedisOptions } from '@nestjs/microservices';

@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: 'RUSH_HOUR_SERVICE',
                imports: [ConfigModule],
                useFactory: (configService: ConfigService): RedisOptions => {
                    const redisUri = new URL(configService.get('REDIS_URI', 'redis://redis:6379'));
                    return {
                        transport: Transport.REDIS,
                        options: {
                            host: redisUri.hostname,
                            port: parseInt(redisUri.port, 6379)
                        }
                    };
                },
                inject: [ConfigService],
            },
        ]),
        ConfigModule
    ],
    providers: [
        RedisService
    ],
    exports: [RedisService]
})
export class RedisModule { }
