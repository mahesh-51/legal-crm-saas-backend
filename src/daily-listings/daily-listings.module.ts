import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyListing, Matter, Client } from '../database/entities';
import { DailyListingsService } from './daily-listings.service';
import { DailyListingsController } from './daily-listings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DailyListing, Matter, Client])],
  controllers: [DailyListingsController],
  providers: [DailyListingsService],
  exports: [DailyListingsService],
})
export class DailyListingsModule {}
