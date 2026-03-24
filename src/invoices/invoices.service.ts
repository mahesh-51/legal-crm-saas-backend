import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, Matter, User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Matter)
    private matterRepo: Repository<Matter>,
  ) {}

  async create(dto: CreateInvoiceDto, user: User): Promise<Invoice> {
    const matter = await this.matterRepo.findOne({
      where: { id: dto.matterId },
      relations: ['client'],
    });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
    await this.assertMatterAccess(matter, user);

    const invoice = this.invoiceRepo.create(dto);
    return this.invoiceRepo.save(invoice);
  }

  async findByMatter(matterId: string, user: User): Promise<Invoice[]> {
    const matter = await this.matterRepo.findOne({
      where: { id: matterId },
      relations: ['client'],
    });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
    await this.assertMatterAccess(matter, user);
    return this.invoiceRepo.find({
      where: { matterId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['matter', 'matter.client'],
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    await this.assertMatterAccess(invoice.matter, user);
    return invoice;
  }

  async update(id: string, dto: UpdateInvoiceDto, user: User): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['matter'],
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    await this.assertMatterAccess(invoice.matter, user);
    Object.assign(invoice, dto);
    return this.invoiceRepo.save(invoice);
  }

  async remove(id: string, user: User): Promise<void> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['matter'],
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    await this.assertMatterAccess(invoice.matter, user);
    await this.invoiceRepo.remove(invoice);
  }

  private async assertMatterAccess(matter: Matter, user: User): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.role === UserRole.CLIENT) {
      if (!matter.client?.userId || matter.client.userId !== user.id) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }
    if (
      (user.role === UserRole.FIRM_ADMIN || user.role === UserRole.LAWYER) &&
      matter.firmId !== user.firmId
    ) {
      throw new ForbiddenException('Access denied');
    }
    if (user.role === UserRole.INDIVIDUAL && matter.createdById !== user.id) {
      throw new ForbiddenException('Access denied');
    }
  }
}
