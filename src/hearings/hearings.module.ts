import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hearing, Matter, Client } from '../database/entities';
import { HearingsService } from './hearings.service';
import { HearingsController } from './hearings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Hearing, Matter, Client])],
  controllers: [HearingsController],
  providers: [HearingsService],
  exports: [HearingsService],
})
export class HearingsModule {}
