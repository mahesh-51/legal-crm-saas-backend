import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { DailyListingStatus } from '../../common/enums/daily-listing-status.enum';

export class CreateDailyListingDto {
  @IsUUID()
  matterId: string;

  /** One or more clients linked to this daily listing (e.g. co-parties). */
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  clientIds: string[];

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
  @IsEnum(DailyListingStatus)
  status?: DailyListingStatus;

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
