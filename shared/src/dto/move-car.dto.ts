import { IsEnum, IsNumber } from "class-validator/types/decorator/decorators";
import { MovementDirection } from "../interfaces/rush-hour.interface";

export class MoveCarDto {
    @IsNumber()
    carId!: number;

    @IsEnum(MovementDirection)
    direction!: MovementDirection;
}