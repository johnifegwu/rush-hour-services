// apps/worker/src/worker.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitMQModule } from '../../../shared/src/modules/rabbitmq.module';
import { RedisModule } from '../../../shared/src/modules/redis.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MoveAnalysisConsumer } from './move-analysis.consumer';
import { MoveQualityConsumer } from './move-quality.consumer';
import { Board, BoardSchema } from 'shared/src/schemas/board.schema';
import { Game, GameSchema } from 'shared/src/schemas/game.schema';
import { RedisService } from 'shared/src/services/redis.service';
import { RabbitMQService } from 'shared/src/services/rabbitmq.service';
import { GameService } from '../../../shared/src/services/game.service';

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
        RabbitMQModule,
        RedisModule
    ],
    providers: [MoveAnalysisConsumer, MoveQualityConsumer,
        GameService,
        RedisService,
        RabbitMQService],
})
export class WorkerModule { }
