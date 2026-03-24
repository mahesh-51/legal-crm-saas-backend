import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Matter,
  Client,
  User,
  CourtType,
  CourtName,
} from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { MatterStatus } from '../common/enums/matter-status.enum';
import { CreateMatterDto } from './dto/create-matter.dto';
import { UpdateMatterDto } from './dto/update-matter.dto';
import { courtRowVisibleForMatterContext } from '../courts/court-scope.util';

@Injectable()
export class MattersService {
  constructor(
    @InjectRepository(Matter)
    private matterRepo: Repository<Matter>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(CourtType)
    private courtTypeRepo: Repository<CourtType>,
    @InjectRepository(CourtName)
    private courtNameRepo: Repository<CourtName>,
  ) {}

  async create(dto: CreateMatterDto, user: User, firmId?: string): Promise<Matter> {
    const effectiveFirmId = dto.firmId ?? firmId ?? user.firmId ?? null;
    const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    await this.assertClientAccess(client, user);
    await this.assertCourtRefs(
      dto.courtTypeId,
      dto.courtNameId,
      effectiveFirmId,
      user.id,
    );

    const matter = this.matterRepo.create({
      matterName: dto.matterName,
      complainants: dto.complainants ?? [],
      defendants: dto.defendants ?? [],
      status: dto.status ?? MatterStatus.OPEN,
      courtTypeId: dto.courtTypeId ?? null,
      courtNameId: dto.courtNameId ?? null,
      caseType: dto.caseType ?? null,
      cnr: dto.cnr ?? null,
      clientId: dto.clientId,
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
        relations: [
          'client',
          'hearings',
          'hearings.client',
          'invoices',
          'courtType',
          'courtName',
        ],
        order: { createdAt: 'DESC' },
      });
    }
    const qb = this.matterRepo
      .createQueryBuilder('matter')
      .leftJoinAndSelect('matter.client', 'client')
      .leftJoinAndSelect('matter.courtType', 'courtType')
      .leftJoinAndSelect('matter.courtName', 'courtName');

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
      relations: [
        'client',
        'hearings',
        'invoices',
        'documents',
        'courtType',
        'courtName',
      ],
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
    const nextCourtTypeId =
      dto.courtTypeId !== undefined ? dto.courtTypeId : matter.courtTypeId;
    const nextCourtNameId =
      dto.courtNameId !== undefined ? dto.courtNameId : matter.courtNameId;
    await this.assertCourtRefs(
      nextCourtTypeId,
      nextCourtNameId,
      matter.firmId,
      matter.createdById,
    );
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

  private async assertCourtRefs(
    courtTypeId?: string | null,
    courtNameId?: string | null,
    matterFirmId?: string | null,
    matterCreatedById?: string,
  ): Promise<void> {
    if (courtTypeId) {
      const ct = await this.courtTypeRepo.findOne({ where: { id: courtTypeId } });
      if (!ct) {
        throw new NotFoundException('Court type not found');
      }
      if (
        !courtRowVisibleForMatterContext(
          ct,
          matterFirmId ?? null,
          matterCreatedById ?? '',
        )
      ) {
        throw new ForbiddenException('Court type not available for this matter');
      }
    }
    if (courtNameId) {
      const cn = await this.courtNameRepo.findOne({ where: { id: courtNameId } });
      if (!cn) {
        throw new NotFoundException('Court name not found');
      }
      if (
        !courtRowVisibleForMatterContext(
          cn,
          matterFirmId ?? null,
          matterCreatedById ?? '',
        )
      ) {
        throw new ForbiddenException('Court name not available for this matter');
      }
      if (courtTypeId && cn.courtTypeId && cn.courtTypeId !== courtTypeId) {
        throw new BadRequestException(
          'Court name does not match the selected court type',
        );
      }
    }
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
