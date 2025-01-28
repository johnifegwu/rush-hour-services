import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CleanupService } from './cleanup.service';
import { Game, GameSchema } from '../../../../shared/src/schemas/game.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Game.name, schema: GameSchema }
        ]),
    ],
    providers: [CleanupService],
})
export class CleanupModule { }
