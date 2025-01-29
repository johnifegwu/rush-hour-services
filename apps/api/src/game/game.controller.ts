import { Controller } from '@nestjs/common';
import { GameService } from '../../../../shared/src/services/game.service';

@Controller('game')
export class GameController {
    constructor(private readonly gameService: GameService) { }

    // Add your game-related endpoints here
}
