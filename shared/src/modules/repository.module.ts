import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Game, GameSchema } from '../schemas/game.schema';
import { Board, BoardSchema } from '../schemas/board.schema';
import { GameMongoRepository } from '../infrastructure/mongodb/game.repository';
import { BoardMongoRepository } from '../infrastructure/mongodb/board.repository';
import { GAME_REPOSITORY } from '../constants/game.constant';
import { BOARD_REPOSITORY } from '../constants/board.constant';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Game.name, schema: GameSchema },
            { name: Board.name, schema: BoardSchema }
        ])
    ],
    providers: [
        {
            provide: GAME_REPOSITORY,
            useClass: GameMongoRepository
        },
        {
            provide: BOARD_REPOSITORY,
            useClass: BoardMongoRepository
        }
    ],
    exports: [GAME_REPOSITORY, BOARD_REPOSITORY]
})
export class RepositoryModule { }