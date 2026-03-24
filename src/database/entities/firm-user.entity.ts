import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FirmRole } from '../../common/enums/firm-role.enum';
import { Firm } from './firm.entity';
import { User } from './user.entity';

@Entity('firm_users')
export class FirmUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'firm_id' })
  firmId: string;

  @ManyToOne(() => Firm, (f) => f.firmUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'firm_id' })
  firm: Firm;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (u) => u.firmUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: FirmRole,
  })
  role: FirmRole;
}
