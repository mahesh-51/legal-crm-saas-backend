import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { DailyListing, Matter, User, Client } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { DailyListingStatus } from '../common/enums/daily-listing-status.enum';
import { CreateDailyListingDto } from './dto/create-daily-listing.dto';
import { UpdateDailyListingDto } from './dto/update-daily-listing.dto';

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDateOnly(
  label: string,
  value: string | undefined,
): string | undefined {
  if (value === undefined || value === '') return undefined;
  const s = value.trim();
  if (!ISO_DATE_ONLY.test(s)) {
    throw new BadRequestException(
      `${label} must be a valid ISO date (YYYY-MM-DD)`,
    );
  }
  const t = Date.parse(`${s}T00:00:00.000Z`);
  if (Number.isNaN(t)) {
    throw new BadRequestException(
      `${label} must be a valid ISO date (YYYY-MM-DD)`,
    );
  }
  return s;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePaginationQuery(
  pageRaw: string | undefined,
  limitRaw: string | undefined,
): { page: number; limit: number } {
  const pageStr = pageRaw?.trim();
  const limitStr = limitRaw?.trim();
  const page =
    pageStr === undefined || pageStr === ''
      ? DEFAULT_PAGE
      : Number(pageStr);
  const limit =
    limitStr === undefined || limitStr === ''
      ? DEFAULT_LIMIT
      : Number(limitStr);
  if (!Number.isInteger(page) || page < 1) {
    throw new BadRequestException('page must be a positive integer');
  }
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT
  ) {
    throw new BadRequestException(
      `limit must be an integer between 1 and ${MAX_LIMIT}`,
    );
  }
  return { page, limit };
}

/** Returns null if there is no searchable text after trim/sanitization. */
function sanitizeLikePattern(raw: string | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  const safe = t.replace(/[%_]/g, '');
  if (!safe) return null;
  return `%${safe}%`;
}

export type DailyListingListItem = {
  id: string;
  matterId: string;
  matterTitle: string;
  clients: Client[];
  caseType: string | null;
  caseNo: string | null;
  complainants: string[] | null;
  defendants: string[] | null;
  status: DailyListingStatus;
  currentDate: Date;
  nextDate: Date | null;
  synopsis: string | null;
  orders: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DailyListingsPaginatedResult = {
  items: DailyListingListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Injectable()
export class DailyListingsService {
  constructor(
    @InjectRepository(DailyListing)
    private dailyListingRepo: Repository<DailyListing>,
    @InjectRepository(Matter)
    private matterRepo: Repository<Matter>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
  ) {}

  async create(dto: CreateDailyListingDto, user: User): Promise<DailyListing> {
    const matter = await this.matterRepo.findOne({
      where: { id: dto.matterId },
      relations: ['client'],
    });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
    await this.assertMatterAccess(matter, user);

    const clients = await this.clientRepo.find({
      where: { id: In(dto.clientIds) },
    });
    if (clients.length !== dto.clientIds.length) {
      throw new NotFoundException('One or more clients not found');
    }
    for (const c of clients) {
      await this.assertClientAccess(c, user);
    }
    this.assertClientsAlignWithMatter(matter, clients);

    const row = this.dailyListingRepo.create({
      matterId: dto.matterId,
      clients,
      caseType: dto.caseType ?? null,
      caseNo: dto.caseNo ?? null,
      complainants: dto.complainants ?? [],
      defendants: dto.defendants ?? [],
      status: dto.status ?? DailyListingStatus.SCHEDULED,
      currentDate: new Date(dto.currentDate),
      nextDate: dto.nextDate ? new Date(dto.nextDate) : null,
      synopsis: dto.synopsis ?? null,
      orders: dto.orders ?? null,
    });
    return this.dailyListingRepo.save(row);
  }

  /**
   * Firm-wide (or ACL-scoped) daily listings with optional search and
   * inclusive `currentDate` bounds. Does not filter on `nextDate`.
   */
  async findAll(
    user: User,
    filters: {
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: string;
      limit?: string;
    },
  ): Promise<DailyListingsPaginatedResult> {
    const { page, limit } = parsePaginationQuery(filters.page, filters.limit);
    const empty = (): DailyListingsPaginatedResult => ({
      items: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    });

    const dateFrom = parseIsoDateOnly('dateFrom', filters.dateFrom);
    const dateTo = parseIsoDateOnly('dateTo', filters.dateTo);
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException('dateFrom must be on or before dateTo');
    }

    const qb = this.dailyListingRepo
      .createQueryBuilder('dl')
      .innerJoinAndSelect('dl.matter', 'matter')
      .leftJoinAndSelect('dl.clients', 'clients');

    if (user.role === UserRole.CLIENT) {
      qb.innerJoin('matter.client', 'matterClient').where(
        'matterClient.userId = :uid',
        { uid: user.id },
      );
    } else if (user.role === UserRole.INDIVIDUAL && !user.firmId) {
      qb.where('matter.createdById = :userId', { userId: user.id });
    } else if (user.firmId) {
      qb.where('matter.firmId = :firmId', { firmId: user.firmId });
    } else if (user.role !== UserRole.SUPER_ADMIN) {
      return empty();
    }

    if (dateFrom) {
      qb.andWhere('dl.currentDate >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('dl.currentDate <= :dateTo', { dateTo });
    }

    const pattern = sanitizeLikePattern(filters.search);
    if (pattern) {
      qb.andWhere(
        new Brackets((qb2) => {
          qb2
            .where('matter.matterName LIKE :pattern', { pattern })
            .orWhere('dl.caseNo LIKE :pattern', { pattern })
            .orWhere('dl.caseType LIKE :pattern', { pattern })
            .orWhere('dl.synopsis LIKE :pattern', { pattern })
            .orWhere('dl.orders LIKE :pattern', { pattern })
            .orWhere('CAST(dl.complainants AS CHAR) LIKE :pattern', {
              pattern,
            })
            .orWhere('CAST(dl.defendants AS CHAR) LIKE :pattern', {
              pattern,
            })
            .orWhere(
              `EXISTS (SELECT 1 FROM daily_listing_clients dlc_s INNER JOIN clients cl_s ON cl_s.id = dlc_s.client_id WHERE dlc_s.daily_listing_id = dl.id AND (cl_s.name LIKE :pattern OR cl_s.email LIKE :pattern))`,
              { pattern },
            );
        }),
      );
    }

    qb.orderBy('dl.currentDate', 'DESC').addOrderBy('dl.createdAt', 'DESC');

    const total = await qb.clone().getCount();
    const rows = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      items: rows.map((row) => this.toListItem(row)),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  private toListItem(
    row: DailyListing & { matter?: Matter },
  ): DailyListingListItem {
    return {
      id: row.id,
      matterId: row.matterId,
      matterTitle: row.matter?.matterName ?? '',
      clients: row.clients ?? [],
      caseType: row.caseType,
      caseNo: row.caseNo,
      complainants: row.complainants,
      defendants: row.defendants,
      status: row.status,
      currentDate: row.currentDate,
      nextDate: row.nextDate,
      synopsis: row.synopsis,
      orders: row.orders,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findByMatter(matterId: string, user: User): Promise<DailyListing[]> {
    const matter = await this.matterRepo.findOne({
      where: { id: matterId },
      relations: ['client'],
    });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
    await this.assertMatterAccess(matter, user);
    return this.dailyListingRepo.find({
      where: { matterId },
      relations: ['clients'],
      order: { currentDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<DailyListing> {
    const row = await this.dailyListingRepo.findOne({
      where: { id },
      relations: ['matter', 'matter.client', 'clients'],
    });
    if (!row) {
      throw new NotFoundException('Daily listing not found');
    }
    await this.assertMatterAccess(row.matter, user);
    return row;
  }

  async update(
    id: string,
    dto: UpdateDailyListingDto,
    user: User,
  ): Promise<DailyListing> {
    const row = await this.dailyListingRepo.findOne({
      where: { id },
      relations: ['matter', 'matter.client', 'clients'],
    });
    if (!row) {
      throw new NotFoundException('Daily listing not found');
    }
    await this.assertMatterAccess(row.matter, user);

    if (dto.currentDate) {
      row.currentDate = new Date(dto.currentDate);
    }
    if (dto.nextDate !== undefined) {
      row.nextDate = dto.nextDate ? new Date(dto.nextDate) : null;
    }
    if (dto.clientIds !== undefined) {
      const clients = await this.clientRepo.find({
        where: { id: In(dto.clientIds) },
      });
      if (clients.length !== dto.clientIds.length) {
        throw new NotFoundException('One or more clients not found');
      }
      for (const c of clients) {
        await this.assertClientAccess(c, user);
      }
      this.assertClientsAlignWithMatter(row.matter, clients);
      row.clients = clients;
    }
    if (dto.caseType !== undefined) row.caseType = dto.caseType;
    if (dto.caseNo !== undefined) row.caseNo = dto.caseNo;
    if (dto.complainants !== undefined) row.complainants = dto.complainants;
    if (dto.defendants !== undefined) row.defendants = dto.defendants;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.synopsis !== undefined) row.synopsis = dto.synopsis;
    if (dto.orders !== undefined) row.orders = dto.orders;

    return this.dailyListingRepo.save(row);
  }

  async remove(id: string, user: User): Promise<void> {
    const row = await this.dailyListingRepo.findOne({
      where: { id },
      relations: ['matter'],
    });
    if (!row) {
      throw new NotFoundException('Daily listing not found');
    }
    await this.assertMatterAccess(row.matter, user);
    await this.dailyListingRepo.remove(row);
  }

  /** Primary matter client must appear in the listing’s clients. */
  private assertClientsAlignWithMatter(matter: Matter, clients: Client[]): void {
    const ids = new Set(clients.map((c) => c.id));
    if (!ids.has(matter.clientId)) {
      throw new BadRequestException(
        'clientIds must include the matter’s primary client',
      );
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
