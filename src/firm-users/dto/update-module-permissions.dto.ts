import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { InviteModulePermissionDto } from './invite-firm-user.dto';

export class UpdateModulePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InviteModulePermissionDto)
  modulePermissions: InviteModulePermissionDto[];
}
