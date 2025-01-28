import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { GameMove } from '../interfaces/rush-hour.interface';

@Schema()
export class Game extends Document {
    @Prop({ required: true })
    boardId!: string;

    @Prop({ required: true, type: [[Number]] })
    currentState!: number[][];

    @Prop({ type: Array })
    moves!: GameMove[];

    @Prop({ required: true })
    lastMoveAt!: Date;

    @Prop({ default: false })
    isSolved!: boolean;

    @Prop({ required: true })
    minimumMovesRequired!: number;
}

export const GameSchema = SchemaFactory.createForClass(Game);