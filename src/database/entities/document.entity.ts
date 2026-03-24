import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Matter } from './matter.entity';
import { User } from './user.entity';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'matter_id' })
  matterId: string;

  @ManyToOne(() => Matter, (m) => m.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matter_id' })
  matter: Matter;

  @Column({ type: 'varchar', length: 500, name: 'file_name' })
  fileName: string;

  @Column({ type: 'varchar', length: 1000, name: 'file_path' })
  filePath: string;

  @Column({ type: 'uuid', name: 'uploaded_by' })
  uploadedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
