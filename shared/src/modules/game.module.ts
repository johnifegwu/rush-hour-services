import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RepositoryModule } from './repository.module';
import { RedisModule } from './redis.module';
import { RabbitMQModule } from './rabbitmq.module';
import { GameService } from '../services/game.service';
import { RedisService } from '../services/redis.service';
import { RabbitMQService } from '../services/rabbitmq.service';

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
        RepositoryModule,
        RedisModule,
        RabbitMQModule
    ],
    providers: [
        GameService,
        RedisService,
        RabbitMQService
    ],
    exports: [GameService]
})
export class GameModule { }