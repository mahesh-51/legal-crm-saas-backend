import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { MatterStatus } from '../../common/enums/matter-status.enum';

export class CreateMatterDto {
  @IsString()
  caseTitle: string;

  @IsOptional()
  @IsString()
  court?: string;

  @IsOptional()
  @IsString()
  caseType?: string;

  @IsOptional()
  @IsEnum(MatterStatus)
  status?: MatterStatus;

  @IsOptional()
  @IsString()
  cnr?: string;

  @IsUUID()
  clientId: string;

  @IsOptional()
  @IsUUID()
  firmId?: string;
}
