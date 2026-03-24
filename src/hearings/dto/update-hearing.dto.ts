import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateHearingDto } from './create-hearing.dto';

/** Matter linkage is fixed after creation; use delete + create to move a hearing. */
export class UpdateHearingDto extends PartialType(
  OmitType(CreateHearingDto, ['matterId'] as const),
) {}
