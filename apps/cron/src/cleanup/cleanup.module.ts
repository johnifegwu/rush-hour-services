import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CleanupService } from './cleanup.service';
import { RabbitMQModule } from '../../../../shared/src/modules/rabbitmq.module';
import { RedisModule } from '../../../../shared/src/modules/redis.module';
import { RedisService } from '../../../../shared/src/services/redis.service';
import { Game, GameSchema } from '../../../../shared/src/schemas/game.schema';

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
            { name: Game.name, schema: GameSchema }
        ]),
        RabbitMQModule,
        RedisModule
    ],
    providers: [CleanupService, RedisService],
})
export class CleanupModule { }
