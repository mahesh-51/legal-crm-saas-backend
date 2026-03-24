import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Firm, User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateFirmDto } from './dto/create-firm.dto';
import { UpdateFirmDto } from './dto/update-firm.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class FirmsService {
  constructor(
    @InjectRepository(Firm)
    private firmRepo: Repository<Firm>,
    private cloudinary: CloudinaryService,
  ) {}

  async create(dto: CreateFirmDto, ownerId: string): Promise<Firm> {
    const existing = await this.firmRepo.findOne({
      where: { subdomain: dto.subdomain },
    });
    if (existing) {
      throw new ConflictException('Subdomain already taken');
    }
    const firm = this.firmRepo.create({
      ...dto,
      ownerId,
    });
    return this.firmRepo.save(firm);
  }

  async findAll(user: User): Promise<Firm[]> {
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.firmRepo.find({
        order: { createdAt: 'DESC' },
      });
    }
    if (user.firmId) {
      return this.firmRepo.find({
        where: { id: user.firmId },
      });
    }
    return [];
  }

  async findOne(id: string, user: User): Promise<Firm> {
    await this.assertFirmAccess(id, user);
    const firm = await this.firmRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!firm) {
      throw new NotFoundException('Firm not found');
    }
    return firm;
  }

  async update(id: string, dto: UpdateFirmDto, user: User): Promise<Firm> {
    await this.assertFirmAccess(id, user);
    const firm = await this.firmRepo.findOne({ where: { id } });
    if (!firm) {
      throw new NotFoundException('Firm not found');
    }
    if (user.role !== UserRole.FIRM_ADMIN && firm.ownerId !== user.id) {
      throw new ForbiddenException('Only firm admin can update firm');
    }
    Object.assign(firm, dto);
    return this.firmRepo.save(firm);
  }

  async uploadLogo(
    id: string,
    file: Express.Multer.File,
    user: User,
  ): Promise<Firm> {
    await this.assertFirmAccess(id, user);
    const firm = await this.firmRepo.findOne({ where: { id } });
    if (!firm) {
      throw new NotFoundException('Firm not found');
    }
    if (user.role !== UserRole.FIRM_ADMIN && firm.ownerId !== user.id) {
      throw new ForbiddenException('Only firm admin can update logo');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file provided');
    }
    const base = this.cloudinary.getBaseFolder();
    const publicId = `${base}/firms/${id}/logo`;
    const { secureUrl } = await this.cloudinary.uploadBuffer(file.buffer, {
      publicId,
      mimetype: file.mimetype,
      overwrite: true,
    });
    firm.logo = secureUrl;
    return this.firmRepo.save(firm);
  }

  private async assertFirmAccess(firmId: string, user: User): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.firmId !== firmId) {
      throw new ForbiddenException('Access denied to this firm');
    }
  }
}
