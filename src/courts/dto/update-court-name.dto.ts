import { PartialType } from '@nestjs/mapped-types';
import { CreateCourtNameDto } from './create-court-name.dto';

export class UpdateCourtNameDto extends PartialType(CreateCourtNameDto) {}
