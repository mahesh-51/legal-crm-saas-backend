import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client, User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
  ) {}

  async create(dto: CreateClientDto, user: User, firmId?: string): Promise<Client> {
    const effectiveFirmId = firmId ?? user.firmId ?? null;
    if (!effectiveFirmId && user.role !== UserRole.INDIVIDUAL) {
      throw new ForbiddenException('Firm context required');
    }
    const client = this.clientRepo.create({
      ...dto,
      firmId: effectiveFirmId,
      createdById: user.id,
    });
    return this.clientRepo.save(client);
  }

  async findAll(user: User, firmId?: string): Promise<Client[]> {
    if (user.role === UserRole.CLIENT) {
      return this.clientRepo.find({
        where: { userId: user.id },
        relations: ['matters'],
        order: { createdAt: 'DESC' },
      });
    }
    const effectiveFirmId = firmId ?? user.firmId;
    if (user.role === UserRole.INDIVIDUAL && !effectiveFirmId) {
      return this.clientRepo.find({
        where: { createdById: user.id },
        relations: ['matters'],
        order: { createdAt: 'DESC' },
      });
    }
    return this.clientRepo.find({
      where: { firmId: effectiveFirmId } as { firmId: string },
      relations: ['matters'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id },
      relations: ['matters', 'firm'],
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    await this.assertClientAccess(client, user);
    return client;
  }

  async update(id: string, dto: UpdateClientDto, user: User): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    await this.assertClientAccess(client, user);
    Object.assign(client, dto);
    return this.clientRepo.save(client);
  }

  async remove(id: string, user: User): Promise<void> {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    await this.assertClientAccess(client, user);
    await this.clientRepo.remove(client);
  }

  private async assertClientAccess(client: Client, user: User): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.role === UserRole.CLIENT && client.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    if (
      (user.role === UserRole.FIRM_ADMIN || user.role === UserRole.LAWYER) &&
      client.firmId &&
      client.firmId !== user.firmId
    ) {
      throw new ForbiddenException('Access denied to this client');
    }
    if (
      user.role === UserRole.INDIVIDUAL &&
      client.createdById !== user.id
    ) {
      throw new ForbiddenException('Access denied to this client');
    }
  }
}
