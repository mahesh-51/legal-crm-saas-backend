import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FirmRole } from '../../common/enums/firm-role.enum';

export class InviteModulePermissionDto {
  @IsString()
  @IsNotEmpty()
  module: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  actions: string[];
}

export class InviteFirmUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(FirmRole)
  @IsNotEmpty()
  role: FirmRole;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InviteModulePermissionDto)
  modulePermissions?: InviteModulePermissionDto[];
}
