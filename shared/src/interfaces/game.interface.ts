import { MovementDirection } from "./rush-hour.interface";

interface CarPosition {
    orientation: 'horizontal' | 'vertical';
    positions: Array<{ row: number; col: number }>;
}

interface MoveResult {
    newState: number[][];
    isValid: boolean;
    isSolved?: boolean;
}

interface SearchState extends State {
    parent?: SearchState;
    path?: Array<{ carId: number; direction: MovementDirection }>;
}
