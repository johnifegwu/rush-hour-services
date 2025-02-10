import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CleanupService } from './cleanup.service';
import { RabbitMQModule } from '../../../../shared/src/modules/rabbitmq.module';
import { RedisModule } from '../../../../shared/src/modules/redis.module';
import { GameModule } from '../../../../shared/src/modules/game.module';
import { RedisService } from '../../../../shared/src/services/redis.service';
import { RepositoryModule } from '../../../../shared/src/modules/repository.module';

@Module({
    imports: [
        ConfigModule.forRoot(),
        ScheduleModule.forRoot(), // This is crucial for cron jobs
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
    providers: [CleanupService, RedisService],
})
export class CleanupModule { }
