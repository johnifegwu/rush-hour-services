import { IsArray, ArrayMaxSize, ArrayMinSize } from 'class-validator';

export class CreateBoardDto {
    @IsArray()
    @ArrayMinSize(6)
    @ArrayMaxSize(6)
    matrix!: number[][];
}