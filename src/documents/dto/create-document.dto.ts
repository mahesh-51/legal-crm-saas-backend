import { IsUUID } from 'class-validator';

export class CreateDocumentDto {
  @IsUUID()
  matterId: string;
}
