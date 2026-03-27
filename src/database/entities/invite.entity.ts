import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InviteStatus } from '../../common/enums/invite-status.enum';
import { InviteRole } from '../../common/enums/invite-role.enum';
import { Firm } from './firm.entity';
import { Client } from './client.entity';
import { ModulePermissionSelection } from '../../common/types/module-permission.type';
import { User } from './user.entity';

@Entity('invites')
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({
    type: 'enum',
    enum: InviteRole,
  })
  role: InviteRole;

  @Column({ type: 'uuid', name: 'firm_id' })
  firmId: string;

  @Column({ type: 'uuid', name: 'client_id', nullable: true })
  clientId: string | null;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client | null;

  @ManyToOne(() => Firm, (f) => f.invites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'firm_id' })
  firm: Firm;

  @Column({ type: 'varchar', length: 500, unique: true })
  token: string;

  @Column({ type: 'json', name: 'module_permissions', nullable: true })
  modulePermissions: ModulePermissionSelection[] | null;

  @Column({
    type: 'enum',
    enum: InviteStatus,
    default: InviteStatus.PENDING,
  })
  status: InviteStatus;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamp', name: 'accepted_at', nullable: true })
  acceptedAt: Date | null;

  @Column({ type: 'uuid', name: 'accepted_by_user_id', nullable: true })
  acceptedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'accepted_by_user_id' })
  acceptedByUser: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
