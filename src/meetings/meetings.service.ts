import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Meeting,
  Matter,
  Client,
  User,
  Firm,
  DailyListing,
} from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { MeetingStatus } from '../common/enums/meeting-status.enum';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { resolveFirmScope, FirmScope } from '../common/firm-scope.util';

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Meeting)
    private meetingRepo: Repository<Meeting>,
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
    dto: CreateMeetingDto,
    user: User,
    firmIdQuery?: string,
  ): Promise<Meeting> {
    const scope = await resolveFirmScope(
      user,
      user.role === UserRole.INDIVIDUAL && !user.firmId
        ? undefined
        : firmIdQuery ?? dto.firmId ?? user.firmId ?? undefined,
      this.firmRepo,
    );

    const resolved = await this.resolveMeetingLinks(dto, scope);
    await this.assertLinksMatchScope(resolved, user, scope);

    const meeting = this.meetingRepo.create({
      firmId: resolved.firmId,
      createdById: user.id,
      organizerId: dto.organizerId ?? null,
      matterId: resolved.matterId,
      clientId: resolved.clientId,
      dailyListingId: resolved.dailyListingId,
      title: dto.title ?? null,
      description: dto.description ?? null,
      location: dto.location ?? null,
      meetingUrl: dto.meetingUrl ?? null,
      meetingLinkProvider: dto.meetingLinkProvider ?? null,
      shareLinkWithClient: dto.shareLinkWithClient ?? true,
      startAt: new Date(dto.startAt),
      endAt: dto.endAt ? new Date(dto.endAt) : null,
      status: dto.status ?? MeetingStatus.SCHEDULED,
      reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : null,
    });
    return this.meetingRepo.save(meeting);
  }

  async findAll(
    user: User,
    firmId?: string,
    filters?: {
      matterId?: string;
      clientId?: string;
      dailyListingId?: string;
      status?: MeetingStatus;
      organizerId?: string;
    },
  ): Promise<Meeting[]> {
    if (user.role === UserRole.CLIENT) {
      return this.findAllForClient(user, filters);
    }

    const scope = await resolveFirmScope(user, firmId, this.firmRepo);
    const qb = this.meetingRepo
      .createQueryBuilder('meeting')
      .leftJoinAndSelect('meeting.matter', 'matter')
      .leftJoinAndSelect('meeting.client', 'client')
      .leftJoinAndSelect('meeting.organizer', 'organizer')
      .leftJoinAndSelect('meeting.dailyListing', 'dailyListing');

    this.applyMeetingScope(qb, scope);

    if (filters?.matterId) {
      qb.andWhere('meeting.matterId = :matterId', {
        matterId: filters.matterId,
      });
    }
    if (filters?.clientId) {
      qb.andWhere('meeting.clientId = :clientId', {
        clientId: filters.clientId,
      });
    }
    if (filters?.dailyListingId) {
      qb.andWhere('meeting.dailyListingId = :dailyListingId', {
        dailyListingId: filters.dailyListingId,
      });
    }
    if (filters?.status) {
      qb.andWhere('meeting.status = :status', { status: filters.status });
    }
    if (filters?.organizerId) {
      qb.andWhere('meeting.organizerId = :organizerId', {
        organizerId: filters.organizerId,
      });
    }

    qb.addOrderBy('meeting.startAt', 'ASC').addOrderBy('meeting.createdAt', 'DESC');
    return qb.getMany();
  }

  private async findAllForClient(
    user: User,
    filters?: {
      matterId?: string;
      clientId?: string;
      dailyListingId?: string;
      status?: MeetingStatus;
      organizerId?: string;
    },
  ): Promise<Meeting[]> {
    const clients = await this.clientRepo.find({
      where: { userId: user.id },
      select: ['id'],
    });
    const clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0) return [];

    const qb = this.meetingRepo
      .createQueryBuilder('meeting')
      .leftJoinAndSelect('meeting.matter', 'matter')
      .leftJoinAndSelect('meeting.client', 'client')
      .leftJoinAndSelect('meeting.organizer', 'organizer')
      .leftJoinAndSelect('meeting.dailyListing', 'dailyListing')
      .where(
        '(meeting.clientId IN (:...clientIds) OR matter.clientId IN (:...clientIds))',
        { clientIds },
      );

    if (filters?.matterId) {
      qb.andWhere('meeting.matterId = :matterId', {
        matterId: filters.matterId,
      });
    }
    if (filters?.clientId) {
      qb.andWhere('meeting.clientId = :clientId', {
        clientId: filters.clientId,
      });
    }
    if (filters?.dailyListingId) {
      qb.andWhere('meeting.dailyListingId = :dailyListingId', {
        dailyListingId: filters.dailyListingId,
      });
    }
    if (filters?.status) {
      qb.andWhere('meeting.status = :status', { status: filters.status });
    }
    if (filters?.organizerId) {
      qb.andWhere('meeting.organizerId = :organizerId', {
        organizerId: filters.organizerId,
      });
    }

    qb.addOrderBy('meeting.startAt', 'ASC').addOrderBy('meeting.createdAt', 'DESC');
    const rows = await qb.getMany();
    return rows.map((m) => this.applyClientMeetingViewIfNeeded(m, user));
  }

  async findOne(id: string, user: User): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({
      where: { id },
      relations: [
        'matter',
        'matter.client',
        'client',
        'organizer',
        'dailyListing',
        'createdBy',
      ],
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    await this.assertMeetingAccess(meeting, user);
    return this.applyClientMeetingViewIfNeeded(meeting, user);
  }

  async update(id: string, dto: UpdateMeetingDto, user: User): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({
      where: { id },
      relations: ['matter', 'matter.client', 'client'],
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    await this.assertMeetingAccess(meeting, user);
    if (user.role === UserRole.CLIENT) {
      throw new ForbiddenException('Access denied');
    }

    const linksTouched =
      dto.matterId !== undefined ||
      dto.clientId !== undefined ||
      dto.dailyListingId !== undefined;

    if (linksTouched) {
      const merged = this.mergeMeetingLinkDto(meeting, dto);
      const resolved = await this.resolveMeetingLinksFromState(
        merged,
        meeting.firmId,
      );
      const scope = this.getScopeForLinkValidation(user, meeting);
      await this.assertLinksMatchScope(resolved, user, scope);
      meeting.matterId = resolved.matterId;
      meeting.clientId = resolved.clientId;
      meeting.dailyListingId = resolved.dailyListingId;
      meeting.firmId = resolved.firmId;
    }

    if (dto.title !== undefined) meeting.title = dto.title;
    if (dto.description !== undefined) meeting.description = dto.description;
    if (dto.location !== undefined) meeting.location = dto.location;
    if (dto.meetingUrl !== undefined) meeting.meetingUrl = dto.meetingUrl;
    if (dto.meetingLinkProvider !== undefined) {
      meeting.meetingLinkProvider = dto.meetingLinkProvider;
    }
    if (dto.shareLinkWithClient !== undefined) {
      meeting.shareLinkWithClient = dto.shareLinkWithClient;
    }
    if (dto.startAt !== undefined) meeting.startAt = new Date(dto.startAt);
    if (dto.endAt !== undefined) {
      meeting.endAt = dto.endAt ? new Date(dto.endAt) : null;
    }
    if (dto.status !== undefined) meeting.status = dto.status;
    if (dto.reminderAt !== undefined) {
      meeting.reminderAt = dto.reminderAt ? new Date(dto.reminderAt) : null;
    }
    if (dto.organizerId !== undefined) meeting.organizerId = dto.organizerId;
    return this.meetingRepo.save(meeting);
  }

  async remove(id: string, user: User): Promise<void> {
    const meeting = await this.meetingRepo.findOne({ where: { id } });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    await this.assertMeetingAccess(meeting, user);
    if (user.role === UserRole.CLIENT) {
      throw new ForbiddenException('Access denied');
    }
    await this.meetingRepo.remove(meeting);
  }

  private applyMeetingScope(
    qb: ReturnType<Repository<Meeting>['createQueryBuilder']>,
    scope: FirmScope,
  ): void {
    if (scope.individualUserId) {
      qb.andWhere('meeting.firmId IS NULL').andWhere(
        '(meeting.createdById = :iid OR meeting.organizerId = :iid OR (matter.id IS NOT NULL AND matter.createdById = :iid) OR (client.id IS NOT NULL AND client.createdById = :iid))',
        { iid: scope.individualUserId },
      );
    } else {
      qb.andWhere('meeting.firmId = :firmId', { firmId: scope.firmId });
    }
  }

  private mergeMeetingLinkDto(meeting: Meeting, dto: UpdateMeetingDto): {
    matterId: string | null;
    clientId: string | null;
    dailyListingId: string | null;
  } {
    return {
      matterId: dto.matterId !== undefined ? dto.matterId : meeting.matterId,
      clientId: dto.clientId !== undefined ? dto.clientId : meeting.clientId,
      dailyListingId:
        dto.dailyListingId !== undefined
          ? dto.dailyListingId
          : meeting.dailyListingId,
    };
  }

  private getScopeForLinkValidation(user: User, meeting: Meeting): FirmScope {
    if (user.role === UserRole.SUPER_ADMIN) {
      return meeting.firmId
        ? { firmId: meeting.firmId, individualUserId: null }
        : { firmId: null, individualUserId: null };
    }
    if (user.role === UserRole.INDIVIDUAL && !user.firmId) {
      return { firmId: null, individualUserId: user.id };
    }
    return { firmId: user.firmId!, individualUserId: null };
  }

  private async resolveMeetingLinks(
    dto: CreateMeetingDto,
    scope: FirmScope,
  ): Promise<{
    matterId: string | null;
    clientId: string | null;
    dailyListingId: string | null;
    firmId: string | null;
  }> {
    const soloFirmId = scope.individualUserId ? null : scope.firmId;
    return this.resolveMeetingLinksFromState(
      {
        matterId: dto.matterId ?? null,
        clientId: dto.clientId ?? null,
        dailyListingId: dto.dailyListingId ?? null,
      },
      soloFirmId,
    );
  }

  private async resolveMeetingLinksFromState(
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
        throw new ForbiddenException(
          'Meeting must belong to your individual scope',
        );
      }
      return;
    }

    if (resolved.firmId !== scope.firmId) {
      throw new ForbiddenException('Linked matter or client is not in this firm');
    }
  }

  /** Hide Teams/Meet/etc. URL for clients when `shareLinkWithClient` is false. */
  private applyClientMeetingViewIfNeeded(meeting: Meeting, user: User): Meeting {
    if (user.role !== UserRole.CLIENT) return meeting;
    if (meeting.shareLinkWithClient) return meeting;
    const copy = Object.assign(new Meeting(), meeting);
    copy.meetingUrl = null;
    copy.meetingLinkProvider = null;
    return copy;
  }

  private async assertMeetingAccess(meeting: Meeting, user: User): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;

    if (user.role === UserRole.CLIENT) {
      const clients = await this.clientRepo.find({
        where: { userId: user.id },
        select: ['id'],
      });
      const ids = new Set(clients.map((c) => c.id));
      if (meeting.clientId && ids.has(meeting.clientId)) return;
      if (meeting.matterId) {
        const matter = await this.matterRepo.findOne({
          where: { id: meeting.matterId },
          relations: ['client'],
        });
        if (matter?.clientId && ids.has(matter.clientId)) return;
      }
      throw new NotFoundException('Meeting not found');
    }

    if (user.role === UserRole.INDIVIDUAL && !user.firmId) {
      if (meeting.firmId !== null) {
        throw new NotFoundException('Meeting not found');
      }
      if (
        meeting.createdById === user.id ||
        meeting.organizerId === user.id
      ) {
        return;
      }
      if (meeting.matterId) {
        const matter = await this.matterRepo.findOne({
          where: { id: meeting.matterId },
        });
        if (matter?.createdById === user.id) return;
      }
      if (meeting.clientId) {
        const client = await this.clientRepo.findOne({
          where: { id: meeting.clientId },
        });
        if (client?.createdById === user.id) return;
      }
      throw new NotFoundException('Meeting not found');
    }

    if (meeting.firmId !== user.firmId) {
      throw new NotFoundException('Meeting not found');
    }
  }
}
