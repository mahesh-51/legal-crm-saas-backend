import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Client,
  DailyListing,
  Firm,
  Invoice,
  Matter,
  User,
  Task,
  Meeting,
} from '../database/entities';
import { MatterStatus } from '../common/enums/matter-status.enum';
import { InvoiceStatus } from '../common/enums/invoice-status.enum';
import { DailyListingStatus } from '../common/enums/daily-listing-status.enum';
import { TaskStatus } from '../common/enums/task-status.enum';
import { TaskKind } from '../common/enums/task-kind.enum';
import { MeetingStatus } from '../common/enums/meeting-status.enum';
import { MeetingLinkProvider } from '../common/enums/meeting-link-provider.enum';
import { resolveFirmScope, FirmScope } from '../common/firm-scope.util';

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
    pendingTasks: DashboardKpiMetric;
    upcomingMeetingsNextDays: DashboardKpiMetric;
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
  upcomingTasks: Array<{
    id: string;
    title: string;
    kind: TaskKind;
    status: TaskStatus;
    dueAt: string | null;
    matterId: string | null;
    clientId: string | null;
    dailyListingId: string | null;
    href: string | null;
  }>;
  upcomingMeetings: Array<{
    id: string;
    title: string | null;
    startAt: string;
    endAt: string | null;
    status: MeetingStatus;
    matterId: string | null;
    clientId: string | null;
    dailyListingId: string | null;
    href: string | null;
    meetingUrl: string | null;
    meetingLinkProvider: MeetingLinkProvider | null;
    shareLinkWithClient: boolean;
  }>;
  upcomingReminders: Array<{
    id: string;
    source: 'task' | 'meeting';
    title: string | null;
    remindAt: string;
    matterId: string | null;
    clientId: string | null;
    href: string | null;
  }>;
};

const RECENT_ACTIVITY_CAP = 20;
/** Upcoming diary KPI: daily listings whose `currentDate` falls in the next 30 UTC calendar days (inclusive of today). */
const UPCOMING_WINDOW_DAYS = 30;
/** Meetings KPI: scheduled meetings with `startAt` in the next N UTC days from now. */
const MEETING_KPI_DAYS = 14;
/** Reminder window for dashboard “upcoming reminders” (tasks + meetings). */
const REMINDER_WINDOW_DAYS = 7;
const UPCOMING_TASKS_CAP = 5;
const UPCOMING_MEETINGS_CAP = 5;
const UPCOMING_REMINDERS_CAP = 10;

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
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    @InjectRepository(Meeting)
    private meetingRepo: Repository<Meeting>,
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
      upcomingTasks,
      upcomingMeetings,
      upcomingReminders,
    ] = await Promise.all([
      this.buildKpis(scope),
      this.buildRecentActivity(scope),
      this.buildTopClients(scope),
      this.buildTopRevenue(scope),
      this.buildTopDailyListings(scope),
      this.buildMattersByStatus(scope),
      this.buildMattersOpenedTrend(scope),
      this.buildUpcomingTasks(scope),
      this.buildUpcomingMeetings(scope),
      this.buildUpcomingReminders(scope),
    ]);

    return {
      kpis,
      recentActivity,
      topClients,
      topRevenue,
      topDailyListings,
      mattersByStatus,
      mattersOpenedTrend,
      upcomingTasks,
      upcomingMeetings,
      upcomingReminders,
    };
  }

  private async resolveScope(
    user: User,
    firmIdParam: string | undefined,
  ): Promise<FirmScope> {
    return resolveFirmScope(user, firmIdParam, this.firmRepo);
  }

  private async buildKpis(
    scope: FirmScope,
  ): Promise<DashboardOverviewResponse['kpis']> {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const startThisMonth = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));

    const [
      activeClients,
      clientsAtMonthStart,
      openMatters,
      upcoming,
      outstanding,
      pendingTasksCount,
      upcomingMeetingsCount,
    ] = await Promise.all([
      this.countClients(scope),
      this.countClientsAsOf(scope, startThisMonth),
      this.countOpenMatters(scope),
      this.countUpcomingCourtDatesNextDays(scope, UPCOMING_WINDOW_DAYS),
      this.sumOutstandingInvoices(scope),
      this.countPendingTasks(scope),
      this.countUpcomingMeetingsNextDays(scope, MEETING_KPI_DAYS),
    ]);

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
      pendingTasks: {
        value: pendingTasksCount,
        deltaPercent: null,
        increaseIsPositive: true,
      },
      upcomingMeetingsNextDays: {
        value: upcomingMeetingsCount,
        deltaPercent: null,
        increaseIsPositive: true,
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
    scope: FirmScope,
  ): Promise<DashboardOverviewResponse['recentActivity']> {
    const { clause, params } = this.matterWhereForScope(scope, 'matter');
    const take = RECENT_ACTIVITY_CAP;

    const taskQb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoin('task.matter', 'matter')
      .leftJoin('task.client', 'client');
    this.applyDashboardTaskScope(taskQb, scope);
    taskQb.orderBy('task.createdAt', 'DESC').take(take);

    const meetingQb = this.meetingRepo
      .createQueryBuilder('meeting')
      .leftJoin('meeting.matter', 'matter')
      .leftJoin('meeting.client', 'client');
    this.applyDashboardMeetingScope(meetingQb, scope);
    meetingQb.orderBy('meeting.createdAt', 'DESC').take(take);

    const [matters, invoices, listings, tasks, meetings] = await Promise.all([
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
      taskQb.getMany(),
      meetingQb.getMany(),
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

    for (const task of tasks) {
      items.push({
        id: `task-${task.id}`,
        type: 'task.created',
        title:
          task.kind === TaskKind.FOLLOW_UP ? 'Follow-up created' : 'Task created',
        description: task.title,
        occurredAt: task.createdAt.toISOString(),
        href: dashboardHref(task.matterId, task.clientId),
      });
    }

    for (const meeting of meetings) {
      items.push({
        id: `meeting-${meeting.id}`,
        type: 'meeting.created',
        title: 'Meeting scheduled',
        description: meeting.title,
        occurredAt: meeting.createdAt.toISOString(),
        href: dashboardHref(meeting.matterId, meeting.clientId),
      });
    }

    items.sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
    return items.slice(0, RECENT_ACTIVITY_CAP);
  }

  private applyDashboardTaskScope(
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

  private applyDashboardMeetingScope(
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

  private async countPendingTasks(scope: FirmScope): Promise<number> {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoin('task.matter', 'matter')
      .leftJoin('task.client', 'client')
      .where('task.status NOT IN (:...done)', {
        done: [TaskStatus.DONE, TaskStatus.CANCELLED],
      });
    this.applyDashboardTaskScope(qb, scope);
    return qb.getCount();
  }

  private async countUpcomingMeetingsNextDays(
    scope: FirmScope,
    days: number,
  ): Promise<number> {
    const now = new Date();
    const end = new Date(now.getTime() + days * 86400000);
    const qb = this.meetingRepo
      .createQueryBuilder('meeting')
      .leftJoin('meeting.matter', 'matter')
      .leftJoin('meeting.client', 'client')
      .where('meeting.status = :st', { st: MeetingStatus.SCHEDULED })
      .andWhere('meeting.startAt >= :now', { now })
      .andWhere('meeting.startAt <= :end', { end });
    this.applyDashboardMeetingScope(qb, scope);
    return qb.getCount();
  }

  private async buildUpcomingTasks(
    scope: FirmScope,
  ): Promise<DashboardOverviewResponse['upcomingTasks']> {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoin('task.matter', 'matter')
      .leftJoin('task.client', 'client')
      .where('task.status NOT IN (:...done)', {
        done: [TaskStatus.DONE, TaskStatus.CANCELLED],
      });
    this.applyDashboardTaskScope(qb, scope);
    qb.addSelect(
      'CASE WHEN task.due_at IS NULL THEN 1 ELSE 0 END',
      'due_null_sort',
    )
      .orderBy('due_null_sort', 'ASC')
      .addOrderBy('task.dueAt', 'ASC')
      .addOrderBy('task.createdAt', 'DESC')
      .take(UPCOMING_TASKS_CAP);
    const rows = await qb.getMany();
    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      kind: t.kind,
      status: t.status,
      dueAt: t.dueAt ? t.dueAt.toISOString() : null,
      matterId: t.matterId,
      clientId: t.clientId,
      dailyListingId: t.dailyListingId,
      href: dashboardHref(t.matterId, t.clientId),
    }));
  }

  private async buildUpcomingMeetings(
    scope: FirmScope,
  ): Promise<DashboardOverviewResponse['upcomingMeetings']> {
    const now = new Date();
    const end = new Date(now.getTime() + MEETING_KPI_DAYS * 86400000);
    const qb = this.meetingRepo
      .createQueryBuilder('meeting')
      .leftJoin('meeting.matter', 'matter')
      .leftJoin('meeting.client', 'client')
      .where('meeting.status = :st', { st: MeetingStatus.SCHEDULED })
      .andWhere('meeting.startAt >= :now', { now })
      .andWhere('meeting.startAt <= :end', { end });
    this.applyDashboardMeetingScope(qb, scope);
    qb.orderBy('meeting.startAt', 'ASC').take(UPCOMING_MEETINGS_CAP);
    const rows = await qb.getMany();
    return rows.map((m) => ({
      id: m.id,
      title: m.title,
      startAt: m.startAt.toISOString(),
      endAt: m.endAt ? m.endAt.toISOString() : null,
      status: m.status,
      matterId: m.matterId,
      clientId: m.clientId,
      dailyListingId: m.dailyListingId,
      href: dashboardHref(m.matterId, m.clientId),
      meetingUrl: m.meetingUrl,
      meetingLinkProvider: m.meetingLinkProvider,
      shareLinkWithClient: m.shareLinkWithClient,
    }));
  }

  private async buildUpcomingReminders(
    scope: FirmScope,
  ): Promise<DashboardOverviewResponse['upcomingReminders']> {
    const now = new Date();
    const windowEnd = new Date(
      now.getTime() + REMINDER_WINDOW_DAYS * 86400000,
    );

    const taskQb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoin('task.matter', 'matter')
      .leftJoin('task.client', 'client')
      .where('task.reminderAt IS NOT NULL')
      .andWhere('task.reminderAt >= :now', { now })
      .andWhere('task.reminderAt <= :windowEnd', { windowEnd })
      .andWhere('task.status NOT IN (:...done)', {
        done: [TaskStatus.DONE, TaskStatus.CANCELLED],
      });
    this.applyDashboardTaskScope(taskQb, scope);
    const taskRows = await taskQb.getMany();

    const meetQb = this.meetingRepo
      .createQueryBuilder('meeting')
      .leftJoin('meeting.matter', 'matter')
      .leftJoin('meeting.client', 'client')
      .where('meeting.reminderAt IS NOT NULL')
      .andWhere('meeting.reminderAt >= :now', { now })
      .andWhere('meeting.reminderAt <= :windowEnd', { windowEnd })
      .andWhere('meeting.status = :st', { st: MeetingStatus.SCHEDULED });
    this.applyDashboardMeetingScope(meetQb, scope);
    const meetingRows = await meetQb.getMany();

    const merged: DashboardOverviewResponse['upcomingReminders'] = [];
    for (const t of taskRows) {
      if (!t.reminderAt) continue;
      merged.push({
        id: t.id,
        source: 'task',
        title: t.title,
        remindAt: t.reminderAt.toISOString(),
        matterId: t.matterId,
        clientId: t.clientId,
        href: dashboardHref(t.matterId, t.clientId),
      });
    }
    for (const m of meetingRows) {
      if (!m.reminderAt) continue;
      merged.push({
        id: m.id,
        source: 'meeting',
        title: m.title,
        remindAt: m.reminderAt.toISOString(),
        matterId: m.matterId,
        clientId: m.clientId,
        href: dashboardHref(m.matterId, m.clientId),
      });
    }
    merged.sort(
      (a, b) =>
        new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime(),
    );
    return merged.slice(0, UPCOMING_REMINDERS_CAP);
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

function dashboardHref(
  matterId: string | null,
  clientId: string | null,
): string | null {
  if (matterId) return `/matters/${matterId}`;
  if (clientId) return `/clients/${clientId}`;
  return null;
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

