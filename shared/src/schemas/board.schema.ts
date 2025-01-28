import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Board extends Document {
    @Prop({ required: true, type: [[Number]] })
    matrix!: number[][];

    @Prop({ default: Date.now })
    createdAt!: Date;
}

export const BoardSchema = SchemaFactory.createForClass(Board);