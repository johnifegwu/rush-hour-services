
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitMQModule } from '../../../shared/src/modules/rabbitmq.module';
import { RedisModule } from '../../../shared/src/modules/redis.module';
import { GameModule } from '../../../shared/src/modules/game.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MoveAnalysisConsumer } from './move-analysis.consumer';
import { MoveQualityConsumer } from './move-quality.consumer';
import { RepositoryModule } from '../../../shared/src/modules/repository.module';
import { RedisService } from 'shared/src/services/redis.service';
import { RabbitMQService } from 'shared/src/services/rabbitmq.service';
import { GameService } from '../../../shared/src/services/game.service';

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
        RabbitMQModule,
        RedisModule,
        GameModule
    ],
    providers: [MoveAnalysisConsumer, MoveQualityConsumer,
        GameService,
        RedisService,
        RabbitMQService],
})
export class WorkerModule { }
