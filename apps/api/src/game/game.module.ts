import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisClientOptions } from 'redis';
import { GameService } from '../../../../shared/src/services/game.service';
import { GameController } from './game.controller';

@Module({
    imports: [
        CacheModule.registerAsync<RedisClientOptions>({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                store: 'redis',
                host: configService.get('REDIS_HOST'),
                port: configService.get('REDIS_PORT'),
                ttl: 300, // 5 minutes cache TTL
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [GameService],
    controllers: [GameController],
})
export class GameModule { }
