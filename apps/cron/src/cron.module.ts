import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { ConfigModule } from '@nestjs/config';
import configuration from '../../../shared/src/config/configuration';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [configuration],
        }),
        ScheduleModule.forRoot(),
    ],
    providers: [CronService],
})
export class CronModule { }