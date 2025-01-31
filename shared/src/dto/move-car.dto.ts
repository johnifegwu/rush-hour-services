import { IsString, IsNumber, IsNotEmpty, Min, Max, IsEnum } from 'class-validator';
import { MovementDirection } from "../interfaces/rush-hour.interface";

export class MoveCarDto {
    @IsNumber()
    carId!: number;

    @IsEnum(MovementDirection)
    direction!: MovementDirection;
}