import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { InvoiceStatus } from '../../common/enums/invoice-status.enum';

export class CreateInvoiceDto {
  @IsUUID()
  matterId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  paymentReference?: string;
}
