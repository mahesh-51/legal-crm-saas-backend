import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { HearingStatus } from '../../common/enums/hearing-status.enum';

export class CreateHearingDto {
  @IsUUID()
  matterId: string;

  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsString()
  caseType?: string;

  @IsOptional()
  @IsString()
  caseNo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  complainants?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defendants?: string[];

  @IsOptional()
  @IsEnum(HearingStatus)
  status?: HearingStatus;

  @IsDateString()
  currentDate: string;

  @IsOptional()
  @IsDateString()
  nextDate?: string;

  @IsOptional()
  @IsString()
  synopsis?: string;

  @IsOptional()
  @IsString()
  orders?: string;
}
