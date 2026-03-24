import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Matter, Client, User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateMatterDto } from './dto/create-matter.dto';
import { UpdateMatterDto } from './dto/update-matter.dto';

@Injectable()
export class MattersService {
  constructor(
    @InjectRepository(Matter)
    private matterRepo: Repository<Matter>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
  ) {}

  async create(dto: CreateMatterDto, user: User, firmId?: string): Promise<Matter> {
    const effectiveFirmId = dto.firmId ?? firmId ?? user.firmId ?? null;
    const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    await this.assertClientAccess(client, user);

    const matter = this.matterRepo.create({
      ...dto,
      firmId: effectiveFirmId,
      createdById: user.id,
    });
    return this.matterRepo.save(matter);
  }

  async findAll(user: User, firmId?: string, clientId?: string): Promise<Matter[]> {
    if (user.role === UserRole.CLIENT) {
      const clients = await this.clientRepo.find({
        where: { userId: user.id },
        select: ['id'],
      });
      const clientIds = clients.map((c) => c.id);
      return this.matterRepo.find({
        where: { clientId: In(clientIds) },
        relations: ['client', 'hearings', 'invoices'],
        order: { createdAt: 'DESC' },
      });
    }
    const qb = this.matterRepo
      .createQueryBuilder('matter')
      .leftJoinAndSelect('matter.client', 'client');

    if (user.role === UserRole.INDIVIDUAL && !user.firmId) {
      qb.where('matter.createdById = :userId', { userId: user.id });
    } else if (user.firmId || firmId) {
      qb.where('matter.firmId = :firmId', { firmId: firmId ?? user.firmId });
    } else if (user.role !== UserRole.SUPER_ADMIN) {
      return [];
    }
    if (clientId) {
      qb.andWhere('matter.clientId = :clientId', { clientId });
    }
    qb.orderBy('matter.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string, user: User): Promise<Matter> {
    const matter = await this.matterRepo.findOne({
      where: { id },
      relations: ['client', 'hearings', 'invoices', 'documents'],
    });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
    await this.assertMatterAccess(matter, user);
    return matter;
  }

  async update(id: string, dto: UpdateMatterDto, user: User): Promise<Matter> {
    const matter = await this.matterRepo.findOne({ where: { id } });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
    await this.assertMatterAccess(matter, user);
    Object.assign(matter, dto);
    return this.matterRepo.save(matter);
  }

  async remove(id: string, user: User): Promise<void> {
    const matter = await this.matterRepo.findOne({ where: { id } });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
    await this.assertMatterAccess(matter, user);
    await this.matterRepo.remove(matter);
  }

  private async assertClientAccess(client: Client, user: User): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.role === UserRole.CLIENT && client.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    if (
      (user.role === UserRole.FIRM_ADMIN || user.role === UserRole.LAWYER) &&
      client.firmId !== user.firmId
    ) {
      throw new ForbiddenException('Access denied');
    }
    if (user.role === UserRole.INDIVIDUAL && client.createdById !== user.id) {
      throw new ForbiddenException('Access denied');
    }
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
