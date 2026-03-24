import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { DailyListingStatus } from '../../common/enums/daily-listing-status.enum';
import { Matter } from './matter.entity';
import { Client } from './client.entity';

@Entity('daily_listings')
export class DailyListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'matter_id' })
  matterId: string;

  @ManyToOne(() => Matter, (m) => m.dailyListings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matter_id' })
  matter: Matter;

  @ManyToMany(() => Client)
  @JoinTable({
    name: 'daily_listing_clients',
    joinColumn: { name: 'daily_listing_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'client_id', referencedColumnName: 'id' },
  })
  clients: Client[];

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'case_type' })
  caseType: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'case_no' })
  caseNo: string | null;

  @Column({ type: 'simple-json', nullable: true })
  complainants: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  defendants: string[] | null;

  @Column({
    type: 'enum',
    enum: DailyListingStatus,
    default: DailyListingStatus.SCHEDULED,
  })
  status: DailyListingStatus;

  @Column({ type: 'date', name: 'current_date' })
  currentDate: Date;

  @Column({ type: 'date', name: 'next_date', nullable: true })
  nextDate: Date | null;

  @Column({ type: 'text', nullable: true })
  synopsis: string | null;

  @Column({ type: 'text', nullable: true })
  orders: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
