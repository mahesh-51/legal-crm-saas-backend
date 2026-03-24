import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { Exclude } from 'class-transformer';
import { Firm } from './firm.entity';
import { FirmUser } from './firm-user.entity';
import { Client } from './client.entity';
import { Matter } from './matter.entity';
import { Document } from './document.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  @Exclude()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true })
  firmId: string | null;

  @ManyToOne(() => Firm, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'firm_id' })
  firm: Firm | null;

  @OneToMany(() => FirmUser, (fu) => fu.user)
  firmUsers: FirmUser[];

  @OneToMany(() => Client, (c) => c.createdBy)
  createdClients: Client[];

  @OneToMany(() => Matter, (m) => m.createdBy)
  createdMatters: Matter[];

  @OneToMany(() => Document, (d) => d.uploadedBy)
  uploadedDocuments: Document[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
