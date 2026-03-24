import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateDailyListingDto } from './create-daily-listing.dto';

/** Matter linkage is fixed after creation; use delete + create to move a row. */
export class UpdateDailyListingDto extends PartialType(
  OmitType(CreateDailyListingDto, ['matterId'] as const),
) {}
