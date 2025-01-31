import { IsString } from 'class-validator';

export class StartGameDto {

    @IsString()
    boardId!: string;
}