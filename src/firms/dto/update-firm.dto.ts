import { PartialType } from '@nestjs/mapped-types';
import { CreateFirmDto } from './create-firm.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateFirmDto extends PartialType(CreateFirmDto) {
  @IsOptional()
  @IsString()
  logo?: string;
}
