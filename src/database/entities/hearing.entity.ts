import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { HearingStatus } from '../../common/enums/hearing-status.enum';
import { Matter } from './matter.entity';
import { Client } from './client.entity';

@Entity('hearings')
export class Hearing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'matter_id' })
  matterId: string;

  @ManyToOne(() => Matter, (m) => m.hearings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matter_id' })
  matter: Matter;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

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
    enum: HearingStatus,
    default: HearingStatus.SCHEDULED,
  })
  status: HearingStatus;

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
