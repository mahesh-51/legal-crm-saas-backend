import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Firm } from './firm.entity';
import { User } from './user.entity';
import { Matter } from './matter.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'uuid', name: 'firm_id', nullable: true })
  firmId: string | null;

  @ManyToOne(() => Firm, (f) => f.clients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'firm_id' })
  firm: Firm | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'portal_access', default: false })
  portalAccess: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @OneToMany(() => Matter, (m) => m.client)
  matters: Matter[];
}
