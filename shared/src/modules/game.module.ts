
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GameService } from '../services/game.service';
import { GameMongoRepository } from '../infrastructure/mongodb/game.repository';
import { BoardMongoRepository } from '../infrastructure/mongodb/board.repository';
import { Game, GameSchema } from '../schemas/game.schema';
import { Board, BoardSchema } from '../schemas/board.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Game.name, schema: GameSchema },
            { name: Board.name, schema: BoardSchema }
        ])
    ],
    providers: [
        GameService,
        {
            provide: 'IGameRepository',
            useClass: GameMongoRepository
        },
        {
            provide: 'IBoardRepository',
            useClass: BoardMongoRepository
        }
    ],
    exports: [GameService]
})
export class GameModule { }
