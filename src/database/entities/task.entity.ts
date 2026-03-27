import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TaskKind } from '../../common/enums/task-kind.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { Firm } from './firm.entity';
import { User } from './user.entity';
import { Client } from './client.entity';
import { Matter } from './matter.entity';
import { DailyListing } from './daily-listing.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'firm_id', nullable: true })
  firmId: string | null;

  @ManyToOne(() => Firm, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'firm_id' })
  firm: Firm | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ type: 'uuid', name: 'assignee_id', nullable: true })
  assigneeId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignee_id' })
  assignee: User | null;

  @Column({ type: 'uuid', name: 'matter_id', nullable: true })
  matterId: string | null;

  @ManyToOne(() => Matter, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matter_id' })
  matter: Matter | null;

  @Column({ type: 'uuid', name: 'client_id', nullable: true })
  clientId: string | null;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client | null;

  @Column({ type: 'uuid', name: 'daily_listing_id', nullable: true })
  dailyListingId: string | null;

  @ManyToOne(() => DailyListing, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'daily_listing_id' })
  dailyListing: DailyListing | null;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: TaskKind,
    default: TaskKind.TASK,
  })
  kind: TaskKind;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @Column({ type: 'datetime', name: 'due_at', nullable: true })
  dueAt: Date | null;

  @Column({ type: 'datetime', name: 'reminder_at', nullable: true })
  reminderAt: Date | null;

  @Column({ type: 'datetime', name: 'reminder_sent_at', nullable: true })
  reminderSentAt: Date | null;

  @Column({ type: 'datetime', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
