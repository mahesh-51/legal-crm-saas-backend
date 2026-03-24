import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { validate as uuidValidate } from 'uuid';
import {
  Client,
  DailyListing,
  Firm,
  Invoice,
  Matter,
  User,
} from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { MatterStatus } from '../common/enums/matter-status.enum';
import { InvoiceStatus } from '../common/enums/invoice-status.enum';
import { DailyListingStatus } from '../common/enums/daily-listing-status.enum';

export type DashboardKpiMetric = {
  value: number;
  deltaPercent: number | null;
  increaseIsPositive?: boolean;
};

export type DashboardOverviewResponse = {
  kpis: {
    activeClients: DashboardKpiMetric;
    openMatters: DashboardKpiMetric;
    upcomingCourtDates: DashboardKpiMetric;
    invoicesOutstanding: DashboardKpiMetric;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    occurredAt: string;
    href: string | null;
  }>;
  topClients: Array<{
    clientId: string;
    name: string;
    score: number;
    subtitle: string | null;
  }>;
  topRevenue: Array<{
    matterId: string;
    matterTitle: string;
    amount: number;
    currency: string;
  }>;
  topDailyListings: Array<{
    id: string;
    matterId: string;
    matterTitle: string;
    caseNo: string | null;
    caseType: string | null;
    currentDate: string;
    status: DailyListingStatus;
  }>;
  mattersByStatus: Array<{ status: string; count: number }>;
  mattersOpenedTrend: Array<{ period: string; count: number }>;
};

const RECENT_ACTIVITY_CAP = 20;
/** Upcoming diary KPI: daily listings whose `currentDate` falls in the next 30 UTC calendar days (inclusive of today). */
const UPCOMING_WINDOW_DAYS = 30;

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Firm)
    private firmRepo: Repository<Firm>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(Matter)
    private matterRepo: Repository<Matter>,
    @InjectRepository(DailyListing)
    private dailyListingRepo: Repository<DailyListing>,
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
  ) {}

  async getOverview(
    user: User,
    firmIdParam: string | undefined,
  ): Promise<DashboardOverviewResponse> {
    const scope = await this.resolveScope(user, firmIdParam);

    const [
      kpis,
      recentActivity,
      topClients,
      topRevenue,
      topDailyListings,
      mattersByStatus,
      mattersOpenedTrend,
    ] = await Promise.all([
      this.buildKpis(scope),
      this.buildRecentActivity(scope),
      this.buildTopClients(scope),
      this.buildTopRevenue(scope),
      this.buildTopDailyListings(scope),
      this.buildMattersByStatus(scope),
      this.buildMattersOpenedTrend(scope),
    ]);

    return {
      kpis,
      recentActivity,
      topClients,
      topRevenue,
      topDailyListings,
      mattersByStatus,
      mattersOpenedTrend,
    };
  }

  private async resolveScope(
    user: User,
    firmIdParam: string | undefined,
  ): Promise<{
    firmId: string | null;
    individualUserId: string | null;
  }> {
    if (user.role === UserRole.CLIENT) {
      throw new ForbiddenException('Access denied');
    }

    if (user.role === UserRole.INDIVIDUAL && !user.firmId) {
      if (firmIdParam) {
        throw new BadRequestException(
          'firmId must not be set for individual users without a firm',
        );
      }
      return { firmId: null, individualUserId: user.id };
    }

    if (!firmIdParam?.trim()) {
      throw new BadRequestException('firmId is required');
    }
    const firmId = firmIdParam.trim();
    if (!uuidValidate(firmId)) {
      throw new BadRequestException('firmId must be a valid UUID');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      const firm = await this.firmRepo.findOne({ where: { id: firmId } });
      if (!firm) {
        throw new NotFoundException('Firm not found');
      }
      return { firmId, individualUserId: null };
    }

    if (user.firmId !== firmId) {
      throw new ForbiddenException('Access denied to this firm');
    }

    return { firmId, individualUserId: null };
  }

  private async buildKpis(
    scope: { firmId: string | null; individualUserId: string | null },
  ): Promise<DashboardOverviewResponse['kpis']> {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const startThisMonth = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));

    const [activeClients, clientsAtMonthStart] = await Promise.all([
      this.countClients(scope),
      this.countClientsAsOf(scope, startThisMonth),
    ]);

    const openMatters = await this.countOpenMatters(scope);

    const upcoming = await this.countUpcomingCourtDatesNextDays(
      scope,
      UPCOMING_WINDOW_DAYS,
    );

    const outstanding = await this.sumOutstandingInvoices(scope);

    return {
      activeClients: {
        value: activeClients,
        deltaPercent: pctChange(clientsAtMonthStart, activeClients),
        increaseIsPositive: true,
      },
      openMatters: {
        value: openMatters,
        deltaPercent: null,
        increaseIsPositive: true,
      },
      upcomingCourtDates: {
        value: upcoming,
        deltaPercent: null,
        increaseIsPositive: true,
      },
      invoicesOutstanding: {
        value: outstanding,
        deltaPercent: null,
        increaseIsPositive: false,
      },
    };
  }

  private clientWhereForScope(
    scope: { firmId: string | null; individualUserId: string | null },
    alias: string,
  ): { clause: string; params: Record<string, string> } {
    if (scope.individualUserId) {
      return {
        clause: `${alias}.createdById = :createdBy`,
        params: { createdBy: scope.individualUserId },
      };
    }
    return {
      clause: `${alias}.firmId = :firmId`,
      params: { firmId: scope.firmId! },
    };
  }

  private matterWhereForScope(
    scope: { firmId: string | null; individualUserId: string | null },
    alias: string,
  ): { clause: string; params: Record<string, string> } {
    if (scope.individualUserId) {
      return {
        clause: `${alias}.createdById = :createdBy`,
        params: { createdBy: scope.individualUserId },
      };
    }
    return {
      clause: `${alias}.firmId = :firmId`,
      params: { firmId: scope.firmId! },
    };
  }

  private async countClients(scope: {
    firmId: string | null;
    individualUserId: string | null;
  }): Promise<number> {
    const { clause, params } = this.clientWhereForScope(scope, 'c');
    const r = await this.clientRepo
      .createQueryBuilder('c')
      .where(clause, params)
      .getCount();
    return r;
  }

  private async countClientsAsOf(
    scope: { firmId: string | null; individualUserId: string | null },
    asOfExclusive: Date,
  ): Promise<number> {
    const { clause, params } = this.clientWhereForScope(scope, 'c');
    return this.clientRepo
      .createQueryBuilder('c')
      .where(clause, params)
      .andWhere('c.createdAt < :asOf', { asOf: asOfExclusive })
      .getCount();
  }

  private async countOpenMatters(scope: {
    firmId: string | null;
    individualUserId: string | null;
  }): Promise<number> {
    const { clause, params } = this.matterWhereForScope(scope, 'matter');
    return this.matterRepo
      .createQueryBuilder('matter')
      .where(clause, params)
      .andWhere('matter.status != :closed', { closed: MatterStatus.CLOSED })
      .getCount();
  }

  /** Listings with `currentDate` in [today, today+N days] (UTC calendar dates). */
  private async countUpcomingCourtDatesNextDays(
    scope: { firmId: string | null; individualUserId: string | null },
    days: number,
  ): Promise<number> {
    const { clause, params } = this.matterWhereForScope(scope, 'matter');
    const t = new Date();
    const fromStr = t.toISOString().slice(0, 10);
    const end = new Date(
      Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + days),
    );
    const toStr = end.toISOString().slice(0, 10);

    return this.dailyListingRepo
      .createQueryBuilder('dl')
      .innerJoin('dl.matter', 'matter')
      .where(clause, params)
      .andWhere('dl.status NOT IN (:...cancelled)', {
        cancelled: [DailyListingStatus.CANCELLED],
      })
      .andWhere('DATE(dl.currentDate) >= :fromStr', { fromStr })
      .andWhere('DATE(dl.currentDate) <= :toStr', { toStr })
      .getCount();
  }

  private async sumOutstandingInvoices(scope: {
    firmId: string | null;
    individualUserId: string | null;
  }): Promise<number> {
    const { clause, params } = this.matterWhereForScope(scope, 'matter');
    const row = await this.invoiceRepo
      .createQueryBuilder('inv')
      .innerJoin('inv.matter', 'matter')
      .select('COALESCE(SUM(inv.amount), 0)', 'sum')
      .where(clause, params)
      .andWhere('inv.status IN (:...st)', {
        st: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE],
      })
      .getRawOne<{ sum: string | null }>();
    return roundMoney(row?.sum);
  }

  private async buildRecentActivity(
    scope: { firmId: string | null; individualUserId: string | null },
  ): Promise<DashboardOverviewResponse['recentActivity']> {
    const { clause, params } = this.matterWhereForScope(scope, 'matter');
    const take = RECENT_ACTIVITY_CAP;

    const [matters, invoices, listings] = await Promise.all([
      this.matterRepo
        .createQueryBuilder('matter')
        .where(clause, params)
        .orderBy('matter.updatedAt', 'DESC')
        .take(take)
        .getMany(),
      this.invoiceRepo
        .createQueryBuilder('inv')
        .innerJoinAndSelect('inv.matter', 'matter')
        .where(clause, params)
        .orderBy('inv.createdAt', 'DESC')
        .take(take)
        .getMany(),
      this.dailyListingRepo
        .createQueryBuilder('dl')
        .innerJoinAndSelect('dl.matter', 'matter')
        .where(clause, params)
        .orderBy('dl.createdAt', 'DESC')
        .take(take)
        .getMany(),
    ]);

    const items: DashboardOverviewResponse['recentActivity'] = [];

    for (const m of matters) {
      const created = m.createdAt.getTime() === m.updatedAt.getTime();
      items.push({
        id: `matter-${m.id}`,
        type: created ? 'matter.created' : 'matter.updated',
        title: created ? 'New matter' : 'Matter updated',
        description: `${m.matterName} → ${m.status}`,
        occurredAt: (created ? m.createdAt : m.updatedAt).toISOString(),
        href: `/matters/${m.id}`,
      });
    }

    for (const inv of invoices) {
      items.push({
        id: `invoice-${inv.id}`,
        type: 'invoice.created',
        title: 'Invoice recorded',
        description: inv.matter
          ? `${inv.matter.matterName} — ${String(inv.status)}`
          : null,
        occurredAt: inv.createdAt.toISOString(),
        href: inv.matterId ? `/matters/${inv.matterId}` : null,
      });
    }

    for (const dl of listings) {
      items.push({
        id: `listing-${dl.id}`,
        type: 'listing.created',
        title: 'Diary listing',
        description: dl.matter
          ? `${dl.matter.matterName} — ${dl.status}`
          : null,
        occurredAt: dl.createdAt.toISOString(),
        href: dl.matterId ? `/matters/${dl.matterId}` : null,
      });
    }

    items.sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
    return items.slice(0, RECENT_ACTIVITY_CAP);
  }

  private async buildTopClients(
    scope: { firmId: string | null; individualUserId: string | null },
  ): Promise<DashboardOverviewResponse['topClients']> {
    const { clause, params } = this.clientWhereForScope(scope, 'c');
    const mw = this.matterWhereForScope(scope, 'm');

    const rows = await this.clientRepo
      .createQueryBuilder('c')
      .leftJoin(
        'c.matters',
        'm',
        `m.status != :closed AND ${mw.clause}`,
        { closed: MatterStatus.CLOSED, ...mw.params },
      )
      .where(clause, params)
      .select('c.id', 'clientId')
      .addSelect('c.name', 'name')
      .addSelect('COUNT(m.id)', 'score')
      .groupBy('c.id')
      .addGroupBy('c.name')
      .having('COUNT(m.id) > 0')
      .orderBy('score', 'DESC')
      .addOrderBy('c.name', 'ASC')
      .limit(5)
      .getRawMany<{ clientId: string; name: string; score: string }>();

    const result: DashboardOverviewResponse['topClients'] = [];
    for (const r of rows) {
      const openCount = parseInt(r.score, 10) || 0;
      result.push({
        clientId: r.clientId,
        name: r.name,
        score: openCount,
        subtitle:
          openCount === 1 ? '1 open matter' : `${openCount} open matters`,
      });
    }
    return result;
  }

  private async buildTopRevenue(
    scope: { firmId: string | null; individualUserId: string | null },
  ): Promise<DashboardOverviewResponse['topRevenue']> {
    const { clause, params } = this.matterWhereForScope(scope, 'matter');
    const since = new Date();
    since.setUTCFullYear(since.getUTCFullYear() - 1);

    const rows = await this.invoiceRepo
      .createQueryBuilder('inv')
      .innerJoin('inv.matter', 'matter')
      .where(clause, params)
      .andWhere('inv.status = :paid', { paid: InvoiceStatus.PAID })
      .andWhere('inv.createdAt >= :since', { since })
      .select('matter.id', 'matterId')
      .addSelect('matter.matterName', 'matterTitle')
      .addSelect('COALESCE(SUM(inv.amount), 0)', 'amount')
      .groupBy('matter.id')
      .addGroupBy('matter.matterName')
      .orderBy('amount', 'DESC')
      .limit(5)
      .getRawMany<{
        matterId: string;
        matterTitle: string;
        amount: string;
      }>();

    return rows.map((r) => ({
      matterId: r.matterId,
      matterTitle: r.matterTitle,
      amount: roundMoney(r.amount),
      currency: 'INR',
    }));
  }

  private async buildTopDailyListings(
    scope: { firmId: string | null; individualUserId: string | null },
  ): Promise<DashboardOverviewResponse['topDailyListings']> {
    const { clause, params } = this.matterWhereForScope(scope, 'matter');
    const today = new Date().toISOString().slice(0, 10);

    const rows = await this.dailyListingRepo
      .createQueryBuilder('dl')
      .innerJoinAndSelect('dl.matter', 'matter')
      .where(clause, params)
      // Same as default diary “today” list: only rows whose `currentDate` is today (UTC).
      .andWhere('DATE(dl.currentDate) = :today', { today })
      .andWhere('dl.status NOT IN (:...cancelled)', {
        cancelled: [DailyListingStatus.CANCELLED],
      })
      .getMany();

    const sorted = [...rows]
      .sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      )
      .slice(0, 5);

    return sorted.map((dl) => ({
      id: dl.id,
      matterId: dl.matterId,
      matterTitle: dl.matter?.matterName ?? '',
      caseNo: dl.caseNo,
      caseType: dl.caseType,
      currentDate: formatDateOnly(dl.currentDate),
      status: dl.status,
    }));
  }

  private async buildMattersByStatus(
    scope: { firmId: string | null; individualUserId: string | null },
  ): Promise<DashboardOverviewResponse['mattersByStatus']> {
    const { clause, params } = this.matterWhereForScope(scope, 'matter');
    const rows = await this.matterRepo
      .createQueryBuilder('matter')
      .select('matter.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where(clause, params)
      .groupBy('matter.status')
      .getRawMany<{ status: string; count: string }>();

    return rows
      .map((r) => ({
        status: r.status,
        count: parseInt(r.count, 10) || 0,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  /** Last 6 calendar months (UTC), including current month; `period` is YYYY-MM. */
  private async buildMattersOpenedTrend(
    scope: { firmId: string | null; individualUserId: string | null },
  ): Promise<DashboardOverviewResponse['mattersOpenedTrend']> {
    const now = new Date();
    const buckets: { period: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1, 0, 0, 0, 0),
      );
      const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const start = d;
      const end = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0),
      );
      buckets.push({ period, start, end });
    }

    const { clause, params } = this.matterWhereForScope(scope, 'matter');
    const out: DashboardOverviewResponse['mattersOpenedTrend'] = [];

    for (const b of buckets) {
      const c = await this.matterRepo
        .createQueryBuilder('matter')
        .where(clause, params)
        .andWhere('matter.createdAt >= :start', { start: b.start })
        .andWhere('matter.createdAt < :end', { end: b.end })
        .getCount();
      out.push({ period: b.period, count: c });
    }

    return out;
  }
}

/** % growth from baseline to current (e.g. active clients vs start of UTC month). */
function pctChange(baseline: number, current: number): number | null {
  if (baseline === 0) return null;
  return Math.round(((current - baseline) / baseline) * 1000) / 10;
}

function roundMoney(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/**
 * Normalize DB `date` / JS `Date` to `YYYY-MM-DD`.
 * MySQL drivers often return DATE columns as strings; calling `toISOString` on those fails.
 */
function formatDateOnly(d: Date | string): string {
  if (typeof d === 'string') {
    return d.length >= 10 ? d.slice(0, 10) : d;
  }
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return String(d).slice(0, 10);
}

