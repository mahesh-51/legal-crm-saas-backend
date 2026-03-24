import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { FirmRole } from '../../common/enums/firm-role.enum';

export class InviteFirmUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(FirmRole)
  @IsNotEmpty()
  role: FirmRole;
}
