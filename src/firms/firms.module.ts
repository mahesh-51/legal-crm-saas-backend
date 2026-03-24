import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Firm } from '../database/entities';
import { FirmsService } from './firms.service';
import { FirmsController } from './firms.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Firm])],
  controllers: [FirmsController],
  providers: [FirmsService],
  exports: [FirmsService],
})
export class FirmsModule {}
