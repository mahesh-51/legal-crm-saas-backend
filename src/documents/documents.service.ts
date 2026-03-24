import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, Matter, User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { DocumentCategory } from '../common/enums/document-category.enum';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  CloudinaryService,
  CloudinaryResourceKind,
} from '../cloudinary/cloudinary.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentRepo: Repository<Document>,
    @InjectRepository(Matter)
    private matterRepo: Repository<Matter>,
    private cloudinary: CloudinaryService,
  ) {}

  async upload(
    matterId: string,
    file: Express.Multer.File,
    user: User,
    category: DocumentCategory = DocumentCategory.GENERAL,
  ): Promise<Document> {
    const matter = await this.matterRepo.findOne({
      where: { id: matterId },
      relations: ['client'],
    });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
    await this.assertMatterAccess(matter, user);
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file provided');
    }

    const base = this.cloudinary.getBaseFolder();
    const ext = path.extname(file.originalname) || '';
    const publicId = `${base}/matters/${matterId}/${uuidv4()}${ext}`;

    const { secureUrl, publicId: returnedPublicId, resourceType } =
      await this.cloudinary.uploadBuffer(file.buffer, {
        publicId,
        mimetype: file.mimetype,
      });

    const doc = this.documentRepo.create({
      matterId,
      fileName: file.originalname,
      filePath: secureUrl,
      cloudinaryPublicId: returnedPublicId,
      cloudinaryResourceType: resourceType,
      uploadedById: user.id,
      category,
    });
    return this.documentRepo.save(doc);
  }

  async findByMatter(matterId: string, user: User): Promise<Document[]> {
    const matter = await this.matterRepo.findOne({
      where: { id: matterId },
      relations: ['client'],
    });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
    await this.assertMatterAccess(matter, user);
    return this.documentRepo.find({
      where: { matterId },
      relations: ['uploadedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<Document> {
    const doc = await this.documentRepo.findOne({
      where: { id },
      relations: ['matter', 'matter.client'],
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    await this.assertMatterAccess(doc.matter, user);
    return doc;
  }

  async remove(id: string, user: User): Promise<void> {
    const doc = await this.documentRepo.findOne({
      where: { id },
      relations: ['matter'],
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    await this.assertMatterAccess(doc.matter, user);

    if (doc.cloudinaryPublicId && doc.cloudinaryResourceType) {
      await this.cloudinary.destroy(
        doc.cloudinaryPublicId,
        doc.cloudinaryResourceType as CloudinaryResourceKind,
      );
    } else if (doc.filePath && !this.isRemoteUrl(doc.filePath)) {
      const resolved = path.resolve(doc.filePath);
      if (fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
      }
    }

    await this.documentRepo.remove(doc);
  }

  getFilePath(doc: Document): string {
    return path.resolve(doc.filePath);
  }

  isRemoteUrl(filePath: string): boolean {
    return filePath.startsWith('https://') || filePath.startsWith('http://');
  }

  private async assertMatterAccess(matter: Matter, user: User): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.role === UserRole.CLIENT) {
      if (!matter.client?.userId || matter.client.userId !== user.id) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }
    if (
      (user.role === UserRole.FIRM_ADMIN || user.role === UserRole.LAWYER) &&
      matter.firmId !== user.firmId
    ) {
      throw new ForbiddenException('Access denied');
    }
    if (user.role === UserRole.INDIVIDUAL && matter.createdById !== user.id) {
      throw new ForbiddenException('Access denied');
    }
  }
}
