import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CourtName, CourtType, User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateCourtNameDto } from './dto/create-court-name.dto';
import { UpdateCourtNameDto } from './dto/update-court-name.dto';
import {
  applyCourtScope,
  resolveWriteScope,
  canUserMutateCourtRow,
  userCanSeeCourtRow,
  tenantScopeFromKeys,
} from './court-scope.util';

@Injectable()
export class CourtNamesService {
  constructor(
    @InjectRepository(CourtName)
    private courtNameRepo: Repository<CourtName>,
    @InjectRepository(CourtType)
    private courtTypeRepo: Repository<CourtType>,
  ) {}

  async create(dto: CreateCourtNameDto, user: User): Promise<CourtName> {
    const scope = resolveWriteScope(user);
    const tenantScope = tenantScopeFromKeys(scope.firmId, scope.userId);
    const existing = await this.courtNameRepo.findOne({
      where: { tenantScope, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('This court name already exists');
    }
    if (dto.courtTypeId) {
      const t = await this.courtTypeRepo.findOne({
        where: { id: dto.courtTypeId },
      });
      if (!t) {
        throw new NotFoundException('Court type not found');
      }
      if (!userCanSeeCourtRow(user, t)) {
        throw new ForbiddenException('Court type not available');
      }
    }
    const row = this.courtNameRepo.create({
      ...dto,
      firmId: scope.firmId,
      userId: scope.userId,
    });
    applyCourtScope(row);
    return this.courtNameRepo.save(row);
  }

  async findAll(user: User, courtTypeId?: string): Promise<CourtName[]> {
    const qb = this.courtNameRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.courtType', 'courtType')
      .orderBy('n.name', 'ASC');
    this.applyVisibilityFilter(qb, user, 'n');
    if (courtTypeId) {
      qb.andWhere('n.courtTypeId = :courtTypeId', { courtTypeId });
    }
    return qb.getMany();
  }

  async findOne(id: string, user: User): Promise<CourtName> {
    const row = await this.courtNameRepo.findOne({
      where: { id },
      relations: ['courtType'],
    });
    if (!row) {
      throw new NotFoundException('Court name not found');
    }
    if (!userCanSeeCourtRow(user, row)) {
      throw new NotFoundException('Court name not found');
    }
    return row;
  }

  async update(id: string, dto: UpdateCourtNameDto, user: User): Promise<CourtName> {
    const row = await this.findOne(id, user);
    if (!canUserMutateCourtRow(user, row)) {
      throw new ForbiddenException('You cannot modify this court name');
    }
    if (dto.name && dto.name !== row.name) {
      const scope = tenantScopeFromKeys(row.firmId, row.userId);
      const existing = await this.courtNameRepo.findOne({
        where: { tenantScope: scope, name: dto.name },
      });
      if (existing && existing.id !== row.id) {
        throw new ConflictException('This court name already exists');
      }
    }
    if (dto.courtTypeId) {
      const t = await this.courtTypeRepo.findOne({
        where: { id: dto.courtTypeId },
      });
      if (!t) {
        throw new NotFoundException('Court type not found');
      }
      if (!userCanSeeCourtRow(user, t)) {
        throw new ForbiddenException('Court type not available');
      }
    }
    Object.assign(row, dto);
    applyCourtScope(row);
    return this.courtNameRepo.save(row);
  }

  async remove(id: string, user: User): Promise<void> {
    const row = await this.findOne(id, user);
    if (!canUserMutateCourtRow(user, row)) {
      throw new ForbiddenException('You cannot delete this court name');
    }
    await this.courtNameRepo.remove(row);
  }

  private applyVisibilityFilter(
    qb: SelectQueryBuilder<CourtName>,
    user: User,
    alias: string,
  ): void {
    if (user.role === UserRole.SUPER_ADMIN) {
      return;
    }
    if (user.role === UserRole.CLIENT) {
      if (user.firmId) {
        qb.where(
          `(${alias}.firm_id IS NULL AND ${alias}.user_id IS NULL) OR ${alias}.firm_id = :firmId`,
          { firmId: user.firmId },
        );
      } else {
        qb.where(`${alias}.firm_id IS NULL AND ${alias}.user_id IS NULL`);
      }
      return;
    }
    if (
      (user.role === UserRole.FIRM_ADMIN || user.role === UserRole.LAWYER) &&
      !user.firmId
    ) {
      qb.where(`${alias}.firm_id IS NULL AND ${alias}.user_id IS NULL`);
      return;
    }
    if (user.role === UserRole.FIRM_ADMIN || user.role === UserRole.LAWYER) {
      qb.where(
        `(${alias}.firm_id IS NULL AND ${alias}.user_id IS NULL) OR ${alias}.firm_id = :firmId`,
        { firmId: user.firmId },
      );
      return;
    }
    if (user.role === UserRole.INDIVIDUAL) {
      qb.where(
        `(${alias}.firm_id IS NULL AND ${alias}.user_id IS NULL) OR ${alias}.user_id = :userId`,
        { userId: user.id },
      );
      return;
    }
    qb.where(`${alias}.firm_id IS NULL AND ${alias}.user_id IS NULL`);
  }
}
