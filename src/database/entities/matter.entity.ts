import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { MatterStatus } from '../../common/enums/matter-status.enum';
import { Client } from './client.entity';
import { Firm } from './firm.entity';
import { User } from './user.entity';
import { DailyListing } from './daily-listing.entity';
import { Invoice } from './invoice.entity';
import { Document } from './document.entity';
import { CourtType, CourtName } from './court-reference.entity';

@Entity('matters')
export class Matter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500, name: 'matter_name' })
  matterName: string;

  @Column({ type: 'simple-json', nullable: true })
  complainants: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  defendants: string[] | null;

  @Column({
    type: 'enum',
    enum: MatterStatus,
    default: MatterStatus.OPEN,
  })
  status: MatterStatus;

  @Column({ type: 'uuid', nullable: true, name: 'court_type_id' })
  courtTypeId: string | null;

  @ManyToOne(() => CourtType, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'court_type_id' })
  courtType: CourtType | null;

  @Column({ type: 'uuid', nullable: true, name: 'court_name_id' })
  courtNameId: string | null;

  @ManyToOne(() => CourtName, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'court_name_id' })
  courtName: CourtName | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'case_type' })
  caseType: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cnr: string | null;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId: string;

  @ManyToOne(() => Client, (c) => c.matters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'uuid', name: 'firm_id', nullable: true })
  firmId: string | null;

  @ManyToOne(() => Firm, (f) => f.matters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'firm_id' })
  firm: Firm | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @OneToMany(() => DailyListing, (d) => d.matter)
  dailyListings: DailyListing[];

  @OneToMany(() => Invoice, (i) => i.matter)
  invoices: Invoice[];

  @OneToMany(() => Document, (d) => d.matter)
  documents: Document[];
}
