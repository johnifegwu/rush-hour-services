import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { ConfigModule } from '@nestjs/config';
import configuration from '../../../shared/src/config/configuration';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [configuration],
        }),
    ],
    providers: [WorkerService],
})
export class WorkerModule { }