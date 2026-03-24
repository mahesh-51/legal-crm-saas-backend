import { PartialType } from '@nestjs/mapped-types';
import { CreateHearingDto } from './create-hearing.dto';

export class UpdateHearingDto extends PartialType(CreateHearingDto) {}
