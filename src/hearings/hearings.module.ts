import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hearing, Matter } from '../database/entities';
import { HearingsService } from './hearings.service';
import { HearingsController } from './hearings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Hearing, Matter])],
  controllers: [HearingsController],
  providers: [HearingsService],
  exports: [HearingsService],
})
export class HearingsModule {}
