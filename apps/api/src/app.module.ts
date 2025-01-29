import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { GameModule } from './game/game.module';
import { Board, Game } from '../../../shared/src/schemas';

@Module({
    imports: [
        ConfigModule.forRoot(),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                uri: configService.get<string>('MONGODB_URI'),
            }),
            inject: [ConfigService],
        }),
        MongooseModule.forFeature([
            { name: 'Board', schema: Board },
            { name: 'Game', schema: Game },
        ]),
        ClientsModule.registerAsync([
            {
                name: 'WORKER_SERVICE',
                imports: [ConfigModule],
                useFactory: async (configService: ConfigService) => ({
                    transport: Transport.RMQ,
                    options: {
                        urls: [configService.get<string>('RABBITMQ_URL')],
                        queue: 'worker_queue',
                    },
                }),
                inject: [ConfigService],
            },
        ]),
        GameModule,
    ],
})
export class AppModule { }
