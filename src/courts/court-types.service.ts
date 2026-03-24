import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CourtType, User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateCourtTypeDto } from './dto/create-court-type.dto';
import { UpdateCourtTypeDto } from './dto/update-court-type.dto';
import {
  applyCourtScope,
  resolveWriteScope,
  canUserMutateCourtRow,
  userCanSeeCourtRow,
  tenantScopeFromKeys,
} from './court-scope.util';

@Injectable()
export class CourtTypesService {
  constructor(
    @InjectRepository(CourtType)
    private courtTypeRepo: Repository<CourtType>,
  ) {}

  async create(dto: CreateCourtTypeDto, user: User): Promise<CourtType> {
    const scope = resolveWriteScope(user);
    const tenantScope = tenantScopeFromKeys(scope.firmId, scope.userId);
    const existing = await this.courtTypeRepo.findOne({
      where: { tenantScope, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Court type with this name already exists');
    }
    const row = this.courtTypeRepo.create({
      ...dto,
      firmId: scope.firmId,
      userId: scope.userId,
    });
    applyCourtScope(row);
    return this.courtTypeRepo.save(row);
  }

  async findAll(user: User): Promise<CourtType[]> {
    const qb = this.courtTypeRepo
      .createQueryBuilder('t')
      .orderBy('t.name', 'ASC');
    this.applyVisibilityFilter(qb, user, 't');
    return qb.getMany();
  }

  async findOne(id: string, user: User): Promise<CourtType> {
    const row = await this.courtTypeRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Court type not found');
    }
    if (!userCanSeeCourtRow(user, row)) {
      throw new NotFoundException('Court type not found');
    }
    return row;
  }

  async update(id: string, dto: UpdateCourtTypeDto, user: User): Promise<CourtType> {
    const row = await this.findOne(id, user);
    if (!canUserMutateCourtRow(user, row)) {
      throw new ForbiddenException('You cannot modify this court type');
    }
    if (dto.name && dto.name !== row.name) {
      const scope = tenantScopeFromKeys(row.firmId, row.userId);
      const existing = await this.courtTypeRepo.findOne({
        where: { tenantScope: scope, name: dto.name },
      });
      if (existing && existing.id !== row.id) {
        throw new ConflictException('Court type with this name already exists');
      }
    }
    Object.assign(row, dto);
    applyCourtScope(row);
    return this.courtTypeRepo.save(row);
  }

  async remove(id: string, user: User): Promise<void> {
    const row = await this.findOne(id, user);
    if (!canUserMutateCourtRow(user, row)) {
      throw new ForbiddenException('You cannot delete this court type');
    }
    await this.courtTypeRepo.remove(row);
  }

  private applyVisibilityFilter(
    qb: SelectQueryBuilder<CourtType>,
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
