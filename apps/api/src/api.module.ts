import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { GameModule } from '../../../shared/src/modules/game.module';
import { RabbitMQModule } from '../../../shared/src/modules/rabbitmq.module';
import { RepositoryModule } from '../../../shared/src/modules/repository.module';
import { RedisModule } from '../../../shared/src/modules/redis.module';
import { GameService } from '../../../shared/src/services';

@Module({
    imports: [
        ConfigModule.forRoot(),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                uri: configService.get<string>('MONGO_URI', 'mongodb://mongodb:27017'),
                useNewUrlParser: true,
                useUnifiedTopology: true,
            }),
            inject: [ConfigService],
        }),
        CacheModule.register({
            ttl: 300, // 5 minutes
            max: 10000 // maximum number of items in cache
        }),
        RepositoryModule, RedisModule, RabbitMQModule, GameModule
    ],
    controllers: [ApiController],
    providers: [ApiService, GameService],
})
export class ApiModule { }
