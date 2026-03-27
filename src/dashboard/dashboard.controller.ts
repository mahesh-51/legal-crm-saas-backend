import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';

/**
 * Firm practice dashboard (aggregated KPIs, activity, charts).
 *
 * Query `firmId` (required for firm users and super admins): same firm ACL as
 * GET /clients?firmId=, GET /matters?firmId=.
 *
 * KPI notes (stable definitions):
 * - activeClients: all clients in scope (no archived column); deltaPercent = % change
 *   vs client count at the start of the current UTC calendar month.
 * - openMatters: matters whose status is not CLOSED (OPEN, ACTIVE, ON_HOLD).
 * - upcomingCourtDates: daily listings with currentDate in the next 30 UTC days (inclusive).
 * - invoicesOutstanding: sum of invoice amounts with status SENT or OVERDUE (unpaid issued).
 *
 * topRevenue: matters ranked by sum of PAID invoice amounts with invoice createdAt in the
 * last 12 months (rolling, UTC). Currency INR (invoices have no currency column).
 *
 * topDailyListings: today’s diary only — `currentDate` equals current UTC calendar date
 * (same idea as GET /daily-listings without a date range). `nextDate` ignored; non-cancelled;
 * up to 5, ordered by `createdAt`.
 *
 * mattersOpenedTrend: last 6 UTC calendar months (including current month), period `YYYY-MM`.
 *
 * Tasks & meetings: `kpis.pendingTasks` = open tasks (not done/cancelled). `kpis.upcomingMeetingsNextDays` =
 * scheduled meetings with `startAt` in the next 14 UTC days. `upcomingTasks` / `upcomingMeetings` are short lists;
 * `upcomingMeetings` includes `meetingUrl`, `meetingLinkProvider`, `shareLinkWithClient` when set.
 * `upcomingReminders` merges task and meeting `reminderAt` in the next 7 UTC days. `recentActivity` may include
 * `task.created` and `meeting.created` types.
 */
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FIRM_ADMIN,
    UserRole.LAWYER,
    UserRole.INDIVIDUAL,
  )
  getOverview(
    @CurrentUser() user: User,
    @Query('firmId') firmId?: string,
  ) {
    return this.dashboardService.getOverview(user, firmId);
  }
}
