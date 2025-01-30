import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CleanupService } from './cleanup.service';
import { RedisService } from 'shared/src/services/redis.service';
import { Game, GameSchema } from 'shared/src/schemas/game.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Game.name, schema: GameSchema }
        ]),
    ],
    providers: [CleanupService, RedisService],
})
export class CleanupModule { }
