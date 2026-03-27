import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MeetingStatus } from '../../common/enums/meeting-status.enum';
import { MeetingLinkProvider } from '../../common/enums/meeting-link-provider.enum';
import { Firm } from './firm.entity';
import { User } from './user.entity';
import { Client } from './client.entity';
import { Matter } from './matter.entity';
import { DailyListing } from './daily-listing.entity';

@Entity('meetings')
export class Meeting {
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

  @Column({ type: 'uuid', name: 'organizer_id', nullable: true })
  organizerId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organizer_id' })
  organizer: User | null;

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

  @Column({ type: 'varchar', length: 500, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 1024, name: 'meeting_url', nullable: true })
  meetingUrl: string | null;

  /** Platform used for the join link (Google Meet, Teams, etc.). */
  @Column({
    type: 'enum',
    enum: MeetingLinkProvider,
    name: 'meeting_link_provider',
    nullable: true,
  })
  meetingLinkProvider: MeetingLinkProvider | null;

  /**
   * When true, clients linked to this meeting may see `meetingUrl` in API responses.
   * When false, lawyers still see the URL; client-facing responses omit the link.
   */
  @Column({ name: 'share_link_with_client', default: true })
  shareLinkWithClient: boolean;

  @Column({ type: 'datetime', name: 'start_at' })
  startAt: Date;

  @Column({ type: 'datetime', name: 'end_at', nullable: true })
  endAt: Date | null;

  @Column({
    type: 'enum',
    enum: MeetingStatus,
    default: MeetingStatus.SCHEDULED,
  })
  status: MeetingStatus;

  @Column({ type: 'datetime', name: 'reminder_at', nullable: true })
  reminderAt: Date | null;

  @Column({ type: 'datetime', name: 'reminder_sent_at', nullable: true })
  reminderSentAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
