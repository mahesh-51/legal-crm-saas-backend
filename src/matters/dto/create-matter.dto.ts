import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { MatterStatus } from '../../common/enums/matter-status.enum';

export class CreateMatterDto {
  @IsString()
  matterName: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  complainants?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defendants?: string[];

  @IsOptional()
  @IsEnum(MatterStatus)
  status?: MatterStatus;

  @IsOptional()
  @IsUUID()
  courtTypeId?: string;

  @IsOptional()
  @IsUUID()
  courtNameId?: string;

  @IsOptional()
  @IsString()
  caseType?: string;

  @IsOptional()
  @IsString()
  cnr?: string;

  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsUUID()
  firmId?: string;
}
