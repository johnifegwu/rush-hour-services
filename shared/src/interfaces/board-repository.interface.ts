
import { Board } from '../schemas/board.schema';
import { IBaseRepository } from './repository.interface';

export interface IBoardRepository extends IBaseRepository<Board> {
    findByDifficulty(difficulty: string): Promise<Board[]>;
}
