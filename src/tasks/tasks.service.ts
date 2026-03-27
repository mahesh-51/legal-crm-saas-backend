import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Task,
  Matter,
  Client,
  User,
  Firm,
  DailyListing,
} from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { TaskStatus } from '../common/enums/task-status.enum';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { resolveFirmScope, FirmScope } from '../common/firm-scope.util';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    @InjectRepository(Matter)
    private matterRepo: Repository<Matter>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(DailyListing)
    private dailyListingRepo: Repository<DailyListing>,
    @InjectRepository(Firm)
    private firmRepo: Repository<Firm>,
  ) {}

  async create(
    dto: CreateTaskDto,
    user: User,
    firmIdQuery?: string,
  ): Promise<Task> {
    const scope = await resolveFirmScope(
      user,
      user.role === UserRole.INDIVIDUAL && !user.firmId
        ? undefined
        : firmIdQuery ?? dto.firmId ?? user.firmId ?? undefined,
      this.firmRepo,
    );

    const resolved = await this.resolveTaskLinks(dto, scope);
    await this.assertLinksMatchScope(resolved, user, scope);

    const task = this.taskRepo.create({
      firmId: resolved.firmId,
      createdById: user.id,
      assigneeId: dto.assigneeId ?? null,
      matterId: resolved.matterId,
      clientId: resolved.clientId,
      dailyListingId: resolved.dailyListingId,
      title: dto.title,
      description: dto.description ?? null,
      kind: dto.kind ?? undefined,
      status: dto.status ?? TaskStatus.PENDING,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : null,
    });
    this.applyStatusSideEffects(task);
    return this.taskRepo.save(task);
  }

  async findAll(
    user: User,
    firmId?: string,
    filters?: {
      matterId?: string;
      clientId?: string;
      dailyListingId?: string;
      status?: TaskStatus;
      assigneeId?: string;
      kind?: string;
    },
  ): Promise<Task[]> {
    if (user.role === UserRole.CLIENT) {
      return this.findAllForClient(user, filters);
    }

    const scope = await resolveFirmScope(user, firmId, this.firmRepo);
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.matter', 'matter')
      .leftJoinAndSelect('task.client', 'client')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.dailyListing', 'dailyListing');

    this.applyTaskScope(qb, scope);

    if (filters?.matterId) {
      qb.andWhere('task.matterId = :matterId', { matterId: filters.matterId });
    }
    if (filters?.clientId) {
      qb.andWhere('task.clientId = :clientId', { clientId: filters.clientId });
    }
    if (filters?.dailyListingId) {
      qb.andWhere('task.dailyListingId = :dailyListingId', {
        dailyListingId: filters.dailyListingId,
      });
    }
    if (filters?.status) {
      qb.andWhere('task.status = :status', { status: filters.status });
    }
    if (filters?.assigneeId) {
      qb.andWhere('task.assigneeId = :assigneeId', {
        assigneeId: filters.assigneeId,
      });
    }
    if (filters?.kind) {
      qb.andWhere('task.kind = :kind', { kind: filters.kind });
    }

    qb.addSelect(
      'CASE WHEN task.due_at IS NULL THEN 1 ELSE 0 END',
      'due_null_sort',
    )
      .orderBy('due_null_sort', 'ASC')
      .addOrderBy('task.dueAt', 'ASC')
      .addOrderBy('task.createdAt', 'DESC');

    return qb.getMany();
  }

  private async findAllForClient(
    user: User,
    filters?: {
      matterId?: string;
      clientId?: string;
      dailyListingId?: string;
      status?: TaskStatus;
      assigneeId?: string;
      kind?: string;
    },
  ): Promise<Task[]> {
    const clients = await this.clientRepo.find({
      where: { userId: user.id },
      select: ['id'],
    });
    const clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0) return [];

    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.matter', 'matter')
      .leftJoinAndSelect('task.client', 'client')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.dailyListing', 'dailyListing')
      .where(
        '(task.clientId IN (:...clientIds) OR matter.clientId IN (:...clientIds))',
        { clientIds },
      );

    if (filters?.matterId) {
      qb.andWhere('task.matterId = :matterId', { matterId: filters.matterId });
    }
    if (filters?.clientId) {
      qb.andWhere('task.clientId = :clientId', { clientId: filters.clientId });
    }
    if (filters?.dailyListingId) {
      qb.andWhere('task.dailyListingId = :dailyListingId', {
        dailyListingId: filters.dailyListingId,
      });
    }
    if (filters?.status) {
      qb.andWhere('task.status = :status', { status: filters.status });
    }
    if (filters?.assigneeId) {
      qb.andWhere('task.assigneeId = :assigneeId', {
        assigneeId: filters.assigneeId,
      });
    }
    if (filters?.kind) {
      qb.andWhere('task.kind = :kind', { kind: filters.kind });
    }

    qb.addSelect(
      'CASE WHEN task.due_at IS NULL THEN 1 ELSE 0 END',
      'due_null_sort',
    )
      .orderBy('due_null_sort', 'ASC')
      .addOrderBy('task.dueAt', 'ASC')
      .addOrderBy('task.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string, user: User): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: [
        'matter',
        'matter.client',
        'client',
        'assignee',
        'dailyListing',
        'createdBy',
      ],
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.assertTaskAccess(task, user);
    return task;
  }

  async update(id: string, dto: UpdateTaskDto, user: User): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['matter', 'matter.client', 'client'],
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.assertTaskAccess(task, user);
    if (user.role === UserRole.CLIENT) {
      throw new ForbiddenException('Access denied');
    }

    const linksTouched =
      dto.matterId !== undefined ||
      dto.clientId !== undefined ||
      dto.dailyListingId !== undefined;

    if (linksTouched) {
      const merged = this.mergeTaskLinkDto(task, dto);
      const resolved = await this.resolveTaskLinksFromState(
        merged,
        task.firmId,
      );
      const scope = this.getScopeForLinkValidation(user, task);
      await this.assertLinksMatchScope(resolved, user, scope);
      task.matterId = resolved.matterId;
      task.clientId = resolved.clientId;
      task.dailyListingId = resolved.dailyListingId;
      task.firmId = resolved.firmId;
    }

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.kind !== undefined) task.kind = dto.kind;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.dueAt !== undefined) {
      task.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    }
    if (dto.reminderAt !== undefined) {
      task.reminderAt = dto.reminderAt ? new Date(dto.reminderAt) : null;
    }
    if (dto.assigneeId !== undefined) task.assigneeId = dto.assigneeId;
    this.applyStatusSideEffects(task);
    return this.taskRepo.save(task);
  }

  async remove(id: string, user: User): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.assertTaskAccess(task, user);
    if (user.role === UserRole.CLIENT) {
      throw new ForbiddenException('Access denied');
    }
    await this.taskRepo.remove(task);
  }

  private applyTaskScope(
    qb: ReturnType<Repository<Task>['createQueryBuilder']>,
    scope: FirmScope,
  ): void {
    if (scope.individualUserId) {
      qb.andWhere('task.firmId IS NULL').andWhere(
        '(task.createdById = :iid OR task.assigneeId = :iid OR (matter.id IS NOT NULL AND matter.createdById = :iid) OR (client.id IS NOT NULL AND client.createdById = :iid))',
        { iid: scope.individualUserId },
      );
    } else {
      qb.andWhere('task.firmId = :firmId', { firmId: scope.firmId });
    }
  }

  private mergeTaskLinkDto(task: Task, dto: UpdateTaskDto): {
    matterId: string | null;
    clientId: string | null;
    dailyListingId: string | null;
  } {
    return {
      matterId: dto.matterId !== undefined ? dto.matterId : task.matterId,
      clientId: dto.clientId !== undefined ? dto.clientId : task.clientId,
      dailyListingId:
        dto.dailyListingId !== undefined
          ? dto.dailyListingId
          : task.dailyListingId,
    };
  }

  private getScopeForLinkValidation(user: User, task: Task): FirmScope {
    if (user.role === UserRole.SUPER_ADMIN) {
      return task.firmId
        ? { firmId: task.firmId, individualUserId: null }
        : { firmId: null, individualUserId: null };
    }
    if (user.role === UserRole.INDIVIDUAL && !user.firmId) {
      return { firmId: null, individualUserId: user.id };
    }
    return { firmId: user.firmId!, individualUserId: null };
  }

  private async resolveTaskLinks(
    dto: CreateTaskDto,
    scope: FirmScope,
  ): Promise<{
    matterId: string | null;
    clientId: string | null;
    dailyListingId: string | null;
    firmId: string | null;
  }> {
    const soloFirmId = scope.individualUserId ? null : scope.firmId;
    return this.resolveTaskLinksFromState(
      {
        matterId: dto.matterId ?? null,
        clientId: dto.clientId ?? null,
        dailyListingId: dto.dailyListingId ?? null,
      },
      soloFirmId,
    );
  }

  private async resolveTaskLinksFromState(
    merged: {
      matterId: string | null;
      clientId: string | null;
      dailyListingId: string | null;
    },
    soloFirmId: string | null,
  ): Promise<{
    matterId: string | null;
    clientId: string | null;
    dailyListingId: string | null;
    firmId: string | null;
  }> {
    let matterId = merged.matterId;
    let clientId = merged.clientId;
    let dailyListingId = merged.dailyListingId;

    if (dailyListingId) {
      const dl = await this.dailyListingRepo.findOne({
        where: { id: dailyListingId },
        relations: ['matter', 'matter.client'],
      });
      if (!dl) {
        throw new NotFoundException('Daily listing not found');
      }
      matterId = dl.matterId;
      clientId = dl.matter.clientId;
    }

    if (matterId) {
      const matter = await this.matterRepo.findOne({
        where: { id: matterId },
        relations: ['client'],
      });
      if (!matter) {
        throw new NotFoundException('Matter not found');
      }
      if (clientId && clientId !== matter.clientId) {
        throw new BadRequestException('clientId does not match the matter');
      }
      clientId = matter.clientId;
      return {
        matterId,
        clientId,
        dailyListingId,
        firmId: matter.firmId,
      };
    }

    if (clientId) {
      const client = await this.clientRepo.findOne({ where: { id: clientId } });
      if (!client) {
        throw new NotFoundException('Client not found');
      }
      return {
        matterId: null,
        clientId,
        dailyListingId,
        firmId: client.firmId,
      };
    }

    return {
      matterId: null,
      clientId: null,
      dailyListingId: null,
      firmId: soloFirmId,
    };
  }

  private async assertLinksMatchScope(
    resolved: { firmId: string | null },
    user: User,
    scope: FirmScope,
  ): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;

    if (scope.individualUserId) {
      if (resolved.firmId !== null) {
        throw new ForbiddenException('Task must belong to your individual scope');
      }
      return;
    }

    if (resolved.firmId !== scope.firmId) {
      throw new ForbiddenException('Linked matter or client is not in this firm');
    }
  }

  private applyStatusSideEffects(task: Task): void {
    if (task.status === TaskStatus.DONE) {
      task.completedAt = task.completedAt ?? new Date();
    } else {
      task.completedAt = null;
    }
  }

  private async assertTaskAccess(task: Task, user: User): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;

    if (user.role === UserRole.CLIENT) {
      const clients = await this.clientRepo.find({
        where: { userId: user.id },
        select: ['id'],
      });
      const ids = new Set(clients.map((c) => c.id));
      if (task.clientId && ids.has(task.clientId)) return;
      if (task.matterId) {
        const matter = await this.matterRepo.findOne({
          where: { id: task.matterId },
          relations: ['client'],
        });
        if (matter?.clientId && ids.has(matter.clientId)) return;
      }
      throw new NotFoundException('Task not found');
    }

    if (user.role === UserRole.INDIVIDUAL && !user.firmId) {
      if (task.firmId !== null) {
        throw new NotFoundException('Task not found');
      }
      if (
        task.createdById === user.id ||
        task.assigneeId === user.id
      ) {
        return;
      }
      if (task.matterId) {
        const matter = await this.matterRepo.findOne({
          where: { id: task.matterId },
        });
        if (matter?.createdById === user.id) return;
      }
      if (task.clientId) {
        const client = await this.clientRepo.findOne({
          where: { id: task.clientId },
        });
        if (client?.createdById === user.id) return;
      }
      throw new NotFoundException('Task not found');
    }

    if (task.firmId !== user.firmId) {
      throw new NotFoundException('Task not found');
    }
  }
}
