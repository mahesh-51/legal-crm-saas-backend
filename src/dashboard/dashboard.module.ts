import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Client,
  DailyListing,
  Firm,
  Invoice,
  Matter,
  Task,
  Meeting,
} from '../database/entities';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Firm,
      Client,
      Matter,
      DailyListing,
      Invoice,
      Task,
      Meeting,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
