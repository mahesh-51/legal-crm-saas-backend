import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hearing, Matter, User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateHearingDto } from './dto/create-hearing.dto';
import { UpdateHearingDto } from './dto/update-hearing.dto';

@Injectable()
export class HearingsService {
  constructor(
    @InjectRepository(Hearing)
    private hearingRepo: Repository<Hearing>,
    @InjectRepository(Matter)
    private matterRepo: Repository<Matter>,
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

    const hearing = this.hearingRepo.create({
      ...dto,
      hearingDate: new Date(dto.hearingDate),
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
      order: { hearingDate: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<Hearing> {
    const hearing = await this.hearingRepo.findOne({
      where: { id },
      relations: ['matter', 'matter.client'],
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
      relations: ['matter'],
    });
    if (!hearing) {
      throw new NotFoundException('Hearing not found');
    }
    await this.assertMatterAccess(hearing.matter, user);
    if (dto.hearingDate) {
      hearing.hearingDate = new Date(dto.hearingDate);
    }
    Object.assign(hearing, {
      ...dto,
      hearingDate: hearing.hearingDate,
    });
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
