import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Firm } from './firm.entity';
import { User } from './user.entity';

@Entity('court_types')
@Unique(['tenantScope', 'name'])
export class CourtType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_scope', type: 'varchar', length: 64, default: 'global' })
  tenantScope: string;

  @Column({ type: 'uuid', nullable: true, name: 'firm_id' })
  firmId: string | null;

  @ManyToOne(() => Firm, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'firm_id' })
  firm: Firm | null;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @OneToMany(() => CourtName, (n) => n.courtType)
  courtNames: CourtName[];
}

@Entity('court_names')
@Unique(['tenantScope', 'name'])
export class CourtName {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_scope', type: 'varchar', length: 64, default: 'global' })
  tenantScope: string;

  @Column({ type: 'uuid', nullable: true, name: 'firm_id' })
  firmId: string | null;

  @ManyToOne(() => Firm, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'firm_id' })
  firm: Firm | null;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 500 })
  name: string;

  @Column({ type: 'uuid', nullable: true, name: 'court_type_id' })
  courtTypeId: string | null;

  @ManyToOne(() => CourtType, (t) => t.courtNames, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'court_type_id' })
  courtType: CourtType | null;
}
