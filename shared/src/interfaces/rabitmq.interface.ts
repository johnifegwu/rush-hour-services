import { MoveCarDto } from "../dto";
import { GameMove } from "./rush-hour.interface";

interface GameProcessingMessage {
    type: string;
    gameId: string;
    currentState: number[][];
}

interface GameAnalysisMessage {
    type: string;
    gameId: string;
    moves: GameMove[];
}

interface CalcMoveQuality {
    type: string,
    gameId: string,
    moveCarDto: MoveCarDto
}
