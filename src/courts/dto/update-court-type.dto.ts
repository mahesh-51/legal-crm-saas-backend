import { PartialType } from '@nestjs/mapped-types';
import { CreateCourtTypeDto } from './create-court-type.dto';

export class UpdateCourtTypeDto extends PartialType(CreateCourtTypeDto) {}
