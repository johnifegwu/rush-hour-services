import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisClientOptions } from 'redis';
import configuration from './config/configuration';

@Global()
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        MongooseModule.forRootAsync({
            useFactory: async () => ({
                uri: configuration().mongodb.uri,
            }),
        }),
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
    exports: [ConfigModule, CacheModule],
})
export class SharedModule { }
