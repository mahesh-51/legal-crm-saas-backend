import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCourtTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
