import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourtType, CourtName } from '../database/entities';
import { COURT_SCOPE_GLOBAL } from './court-scope.util';

const DEFAULT_COURT_TYPES = [
  'Civil',
  'Criminal',
  'Family',
  'Commercial',
  'Labour',
  'Constitutional',
];

const DEFAULT_COURT_NAMES: { name: string; typeName: string | null }[] = [
  { name: 'Supreme Court of India', typeName: null },
  { name: 'Delhi High Court', typeName: 'Civil' },
  { name: 'Bombay High Court', typeName: 'Civil' },
  { name: 'Karnataka High Court', typeName: 'Criminal' },
  { name: 'District Court', typeName: 'Civil' },
  { name: 'Sessions Court', typeName: 'Criminal' },
];

@Injectable()
export class CourtsSeedService implements OnModuleInit {
  constructor(
    @InjectRepository(CourtType)
    private courtTypeRepo: Repository<CourtType>,
    @InjectRepository(CourtName)
    private courtNameRepo: Repository<CourtName>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedCourtTypes();
    await this.seedCourtNames();
  }

  private async seedCourtTypes(): Promise<void> {
    const count = await this.courtTypeRepo.count({
      where: { tenantScope: COURT_SCOPE_GLOBAL },
    });
    if (count > 0) {
      return;
    }
    for (const name of DEFAULT_COURT_TYPES) {
      await this.courtTypeRepo.save(this.courtTypeRepo.create({ name }));
    }
  }

  private async seedCourtNames(): Promise<void> {
    const count = await this.courtNameRepo.count({
      where: { tenantScope: COURT_SCOPE_GLOBAL },
    });
    if (count > 0) {
      return;
    }
    const types = await this.courtTypeRepo.find({
      where: { tenantScope: COURT_SCOPE_GLOBAL },
    });
    const byName = new Map(types.map((t) => [t.name, t]));
    for (const { name, typeName } of DEFAULT_COURT_NAMES) {
      const ct = typeName ? byName.get(typeName) ?? null : null;
      await this.courtNameRepo.save(
        this.courtNameRepo.create({
          name,
          courtTypeId: ct?.id ?? null,
        }),
      );
    }
  }
}
