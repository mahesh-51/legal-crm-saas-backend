import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourtType, CourtName } from '../database/entities';
import { CourtTypesService } from './court-types.service';
import { CourtNamesService } from './court-names.service';
import { CourtTypesController } from './court-types.controller';
import { CourtNamesController } from './court-names.controller';
import { CourtsSeedService } from './courts-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([CourtType, CourtName])],
  controllers: [CourtTypesController, CourtNamesController],
  providers: [CourtTypesService, CourtNamesService, CourtsSeedService],
  exports: [CourtTypesService, CourtNamesService],
})
export class CourtsModule {}
