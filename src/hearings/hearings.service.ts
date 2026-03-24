import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hearing, Matter, User, Client } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { HearingStatus } from '../common/enums/hearing-status.enum';
import { CreateHearingDto } from './dto/create-hearing.dto';
import { UpdateHearingDto } from './dto/update-hearing.dto';

@Injectable()
export class HearingsService {
  constructor(
    @InjectRepository(Hearing)
    private hearingRepo: Repository<Hearing>,
    @InjectRepository(Matter)
    private matterRepo: Repository<Matter>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
  ) {}

  async create(dto: CreateHearingDto, user: User): Promise<Hearing> {
    const matter = await this.matterRepo.findOne({
      where: { id: dto.matterId },
      relations: ['client'],
    });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
    await this.assertMatterAccess(matter, user);

    if (matter.clientId !== dto.clientId) {
      throw new BadRequestException(
        'clientId must match the client linked to this matter',
      );
    }

    const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const hearing = this.hearingRepo.create({
      matterId: dto.matterId,
      clientId: dto.clientId,
      caseType: dto.caseType ?? null,
      caseNo: dto.caseNo ?? null,
      complainants: dto.complainants ?? [],
      defendants: dto.defendants ?? [],
      status: dto.status ?? HearingStatus.SCHEDULED,
      currentDate: new Date(dto.currentDate),
      nextDate: dto.nextDate ? new Date(dto.nextDate) : null,
      synopsis: dto.synopsis ?? null,
      orders: dto.orders ?? null,
    });
    return this.hearingRepo.save(hearing);
  }

  async findByMatter(matterId: string, user: User): Promise<Hearing[]> {
    const matter = await this.matterRepo.findOne({
      where: { id: matterId },
      relations: ['client'],
    });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
    await this.assertMatterAccess(matter, user);
    return this.hearingRepo.find({
      where: { matterId },
      relations: ['client'],
      order: { currentDate: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<Hearing> {
    const hearing = await this.hearingRepo.findOne({
      where: { id },
      relations: ['matter', 'matter.client', 'client'],
    });
    if (!hearing) {
      throw new NotFoundException('Hearing not found');
    }
    await this.assertMatterAccess(hearing.matter, user);
    return hearing;
  }

  async update(id: string, dto: UpdateHearingDto, user: User): Promise<Hearing> {
    const hearing = await this.hearingRepo.findOne({
      where: { id },
      relations: ['matter', 'matter.client'],
    });
    if (!hearing) {
      throw new NotFoundException('Hearing not found');
    }
    await this.assertMatterAccess(hearing.matter, user);

    if (dto.currentDate) {
      hearing.currentDate = new Date(dto.currentDate);
    }
    if (dto.nextDate !== undefined) {
      hearing.nextDate = dto.nextDate ? new Date(dto.nextDate) : null;
    }
    if (dto.clientId !== undefined) {
      if (dto.clientId !== hearing.matter.clientId) {
        throw new BadRequestException(
          'clientId must match the client linked to this matter',
        );
      }
      hearing.clientId = dto.clientId;
    }
    if (dto.caseType !== undefined) hearing.caseType = dto.caseType;
    if (dto.caseNo !== undefined) hearing.caseNo = dto.caseNo;
    if (dto.complainants !== undefined) hearing.complainants = dto.complainants;
    if (dto.defendants !== undefined) hearing.defendants = dto.defendants;
    if (dto.status !== undefined) hearing.status = dto.status;
    if (dto.synopsis !== undefined) hearing.synopsis = dto.synopsis;
    if (dto.orders !== undefined) hearing.orders = dto.orders;

    return this.hearingRepo.save(hearing);
  }

  async remove(id: string, user: User): Promise<void> {
    const hearing = await this.hearingRepo.findOne({
      where: { id },
      relations: ['matter'],
    });
    if (!hearing) {
      throw new NotFoundException('Hearing not found');
    }
    await this.assertMatterAccess(hearing.matter, user);
    await this.hearingRepo.remove(hearing);
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
