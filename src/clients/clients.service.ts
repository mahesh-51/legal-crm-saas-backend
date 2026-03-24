import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client, User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { VerificationStatus } from '../common/enums/verification-status.enum';
import { VerificationDocumentType } from '../common/enums/verification-document-type.enum';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    private cloudinary: CloudinaryService,
  ) {}

  async create(dto: CreateClientDto, user: User, firmId?: string): Promise<Client> {
    const effectiveFirmId = firmId ?? user.firmId ?? null;
    if (!effectiveFirmId && user.role !== UserRole.INDIVIDUAL) {
      throw new ForbiddenException('Firm context required');
    }
    const client = this.clientRepo.create({
      ...dto,
      firmId: effectiveFirmId,
      createdById: user.id,
    });
    if (dto.verificationDocumentType === undefined) {
      client.verificationDocumentType = null;
    }
    this.normalizeKycExclusivity(client, {
      resetWhenTypeNull: dto.verificationDocumentType === null,
    });
    this.assertVerifiedKyc(client);
    return this.clientRepo.save(client);
  }

  async findAll(user: User, firmId?: string): Promise<Client[]> {
    if (user.role === UserRole.CLIENT) {
      return this.clientRepo.find({
        where: { userId: user.id },
        relations: ['matters'],
        order: { createdAt: 'DESC' },
      });
    }
    const effectiveFirmId = firmId ?? user.firmId;
    if (user.role === UserRole.INDIVIDUAL && !effectiveFirmId) {
      return this.clientRepo.find({
        where: { createdById: user.id },
        relations: ['matters'],
        order: { createdAt: 'DESC' },
      });
    }
    return this.clientRepo.find({
      where: { firmId: effectiveFirmId } as { firmId: string },
      relations: ['matters'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id },
      relations: ['matters', 'firm'],
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    await this.assertClientAccess(client, user);
    return client;
  }

  async update(id: string, dto: UpdateClientDto, user: User): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    await this.assertClientAccess(client, user);
    const resetWhenTypeNull =
      Object.prototype.hasOwnProperty.call(dto, 'verificationDocumentType') &&
      dto.verificationDocumentType === null;
    Object.assign(client, dto);
    this.normalizeKycExclusivity(client, { resetWhenTypeNull });
    this.assertVerifiedKyc(client);
    return this.clientRepo.save(client);
  }

  async remove(id: string, user: User): Promise<void> {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    await this.assertClientAccess(client, user);
    await this.clientRepo.remove(client);
  }

  async uploadKycDocument(
    id: string,
    kind: 'aadhaar' | 'pan' | 'driving',
    file: Express.Multer.File,
    user: User,
  ): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    await this.assertClientAccess(client, user);
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file provided');
    }
    const base = this.cloudinary.getBaseFolder();
    const publicId = `${base}/clients/${id}/kyc-${kind}`;
    const { secureUrl } = await this.cloudinary.uploadBuffer(file.buffer, {
      publicId,
      mimetype: file.mimetype,
      overwrite: true,
    });
    if (kind === 'aadhaar') {
      client.aadhaarDocumentUrl = secureUrl;
    } else if (kind === 'pan') {
      client.panDocumentUrl = secureUrl;
    } else {
      client.drivingLicenseDocumentUrl = secureUrl;
    }
    return this.clientRepo.save(client);
  }

  /**
   * Keeps a single chosen document type: clears other identifier and upload slots.
   * When `verificationDocumentType` is explicitly set to null (update), clears all KYC fields.
   */
  private normalizeKycExclusivity(
    client: Client,
    options?: { resetWhenTypeNull?: boolean },
  ): void {
    const t = client.verificationDocumentType;
    if (t === null || t === undefined) {
      if (options?.resetWhenTypeNull) {
        client.aadhaarCard = null;
        client.panCard = null;
        client.drivingLicense = null;
        client.aadhaarDocumentUrl = null;
        client.panDocumentUrl = null;
        client.drivingLicenseDocumentUrl = null;
      }
      return;
    }
    switch (t) {
      case VerificationDocumentType.AADHAAR:
        client.panCard = null;
        client.drivingLicense = null;
        client.panDocumentUrl = null;
        client.drivingLicenseDocumentUrl = null;
        break;
      case VerificationDocumentType.PAN:
        client.aadhaarCard = null;
        client.drivingLicense = null;
        client.aadhaarDocumentUrl = null;
        client.drivingLicenseDocumentUrl = null;
        break;
      case VerificationDocumentType.DRIVING:
        client.aadhaarCard = null;
        client.panCard = null;
        client.aadhaarDocumentUrl = null;
        client.panDocumentUrl = null;
        break;
      default:
        break;
    }
  }

  private assertVerifiedKyc(client: Client): void {
    if (client.verificationStatus !== VerificationStatus.VERIFIED) {
      return;
    }
    if (!client.verificationDocumentType) {
      throw new BadRequestException(
        'verificationDocumentType is required when verificationStatus is VERIFIED',
      );
    }
    let identifier: string | null = null;
    switch (client.verificationDocumentType) {
      case VerificationDocumentType.AADHAAR:
        identifier = client.aadhaarCard;
        break;
      case VerificationDocumentType.PAN:
        identifier = client.panCard;
        break;
      case VerificationDocumentType.DRIVING:
        identifier = client.drivingLicense;
        break;
      default:
        break;
    }
    if (!identifier?.trim()) {
      throw new BadRequestException(
        'The identifier for the selected verificationDocumentType is required when verificationStatus is VERIFIED',
      );
    }
  }

  private async assertClientAccess(client: Client, user: User): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.role === UserRole.CLIENT && client.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    if (
      (user.role === UserRole.FIRM_ADMIN || user.role === UserRole.LAWYER) &&
      client.firmId &&
      client.firmId !== user.firmId
    ) {
      throw new ForbiddenException('Access denied to this client');
    }
    if (
      user.role === UserRole.INDIVIDUAL &&
      client.createdById !== user.id
    ) {
      throw new ForbiddenException('Access denied to this client');
    }
  }
}
