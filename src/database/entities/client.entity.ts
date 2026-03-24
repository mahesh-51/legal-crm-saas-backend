import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { VerificationStatus } from '../../common/enums/verification-status.enum';
import { VerificationDocumentType } from '../../common/enums/verification-document-type.enum';
import { Firm } from './firm.entity';
import { User } from './user.entity';
import { Matter } from './matter.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
    name: 'verification_status',
  })
  verificationStatus: VerificationStatus;

  @Column({
    type: 'enum',
    enum: VerificationDocumentType,
    nullable: true,
    name: 'verification_document_type',
  })
  verificationDocumentType: VerificationDocumentType | null;

  /** Last digits / reference text for Aadhaar (not the uploaded file path). */
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'aadhaar_card' })
  aadhaarCard: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'pan_card' })
  panCard: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'driving_license',
  })
  drivingLicense: string | null;

  @Column({
    type: 'varchar',
    length: 1024,
    nullable: true,
    name: 'aadhaar_document_url',
  })
  aadhaarDocumentUrl: string | null;

  @Column({
    type: 'varchar',
    length: 1024,
    nullable: true,
    name: 'pan_document_url',
  })
  panDocumentUrl: string | null;

  @Column({
    type: 'varchar',
    length: 1024,
    nullable: true,
    name: 'driving_license_document_url',
  })
  drivingLicenseDocumentUrl: string | null;

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

  @Column({
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @OneToMany(() => Matter, (m) => m.client)
  matters: Matter[];
}
