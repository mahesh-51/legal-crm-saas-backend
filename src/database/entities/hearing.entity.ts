import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Matter } from './matter.entity';

@Entity('hearings')
export class Hearing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'matter_id' })
  matterId: string;

  @ManyToOne(() => Matter, (m) => m.hearings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matter_id' })
  matter: Matter;

  @Column({ type: 'date', name: 'hearing_date' })
  hearingDate: Date;

  @Column({ type: 'text', nullable: true })
  synopsis: string | null;

  @Column({ type: 'text', nullable: true })
  orders: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
