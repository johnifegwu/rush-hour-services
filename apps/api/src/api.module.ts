import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { GameService } from 'shared/src/services';
import { Board, BoardSchema, Game, GameSchema } from 'shared/src/schemas';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Board.name, schema: BoardSchema },
            { name: Game.name, schema: GameSchema }
        ]),
        CacheModule.register({
            ttl: 300, // 5 minutes
            max: 10000 // maximum number of items in cache
        }),
    ],
    controllers: [ApiController],
    providers: [ApiService, GameService],
})
export class ApiModule { }
