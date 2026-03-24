import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Matter, Client } from '../database/entities';
import { MattersService } from './matters.service';
import { MattersController } from './matters.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Matter, Client])],
  controllers: [MattersController],
  providers: [MattersService],
  exports: [MattersService],
})
export class MattersModule {}
