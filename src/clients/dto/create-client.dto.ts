import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { VerificationStatus } from '../../common/enums/verification-status.enum';
import { VerificationDocumentType } from '../../common/enums/verification-document-type.enum';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @IsOptional()
  @IsEnum(VerificationDocumentType)
  verificationDocumentType?: VerificationDocumentType | null;

  @IsOptional()
  @IsString()
  aadhaarCard?: string;

  @IsOptional()
  @IsString()
  panCard?: string;

  @IsOptional()
  @IsString()
  drivingLicense?: string;
}
