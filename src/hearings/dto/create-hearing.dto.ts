import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateHearingDto {
  @IsUUID()
  matterId: string;

  @IsDateString()
  hearingDate: string;

  @IsOptional()
  @IsString()
  synopsis?: string;

  @IsOptional()
  @IsString()
  orders?: string;
}
