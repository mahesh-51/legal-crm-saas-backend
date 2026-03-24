import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { InviteRole } from '../../common/enums/invite-role.enum';

export class CreateInviteDto {
  @IsEmail()
  email: string;

  @IsEnum(InviteRole)
  role: InviteRole;

  @IsString()
  firmId: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;
}
