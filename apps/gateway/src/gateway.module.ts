import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from '../../../shared/src/config/configuration';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [configuration],
        }),
        ClientsModule.registerAsync([
            {
                name: 'API_SERVICE',
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.RMQ,
                    options: {
                        urls: [configService.get('rabbitmq.uri')],
                        queue: 'api_queue',
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    controllers: [GatewayController],
})
export class GatewayModule { }