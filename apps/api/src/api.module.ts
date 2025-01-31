import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { RabbitMQModule } from '../../../shared/src/modules/rabbitmq.module';
import { RedisModule } from '../../../shared/src/modules/redis.module';
import { GameService } from '../../../shared/src/services';
import { Board, BoardSchema, Game, GameSchema } from '../../../shared/src/schemas';

@Module({
    imports: [
        ConfigModule.forRoot(),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                uri: configService.get<string>('MONGODB_URI', 'mongodb://mongodb:27017'),
                useNewUrlParser: true,
                useUnifiedTopology: true,
            }),
            inject: [ConfigService],
        }),
        MongooseModule.forFeature([
            { name: Board.name, schema: BoardSchema },
            { name: Game.name, schema: GameSchema }
        ]),
        CacheModule.register({
            ttl: 300, // 5 minutes
            max: 10000 // maximum number of items in cache
        }),
        RedisModule, RabbitMQModule,
    ],
    controllers: [ApiController],
    providers: [ApiService, GameService],
})
export class ApiModule { }
