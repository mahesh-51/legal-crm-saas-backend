import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { FirmUser } from './firm-user.entity';
import { Client } from './client.entity';
import { Matter } from './matter.entity';
import { Invite } from './invite.entity';

@Entity('firms')
export class Firm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo: string | null;

  @Column({ type: 'varchar', length: 100, unique: true })
  subdomain: string;

  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @OneToMany(() => FirmUser, (fu) => fu.firm)
  firmUsers: FirmUser[];

  @OneToMany(() => Client, (c) => c.firm)
  clients: Client[];

  @OneToMany(() => Matter, (m) => m.firm)
  matters: Matter[];

  @OneToMany(() => Invite, (i) => i.firm)
  invites: Invite[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
