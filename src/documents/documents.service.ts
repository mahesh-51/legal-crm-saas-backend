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
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentRepo: Repository<Document>,
    @InjectRepository(Matter)
    private matterRepo: Repository<Matter>,
    private config: ConfigService,
  ) {}

  async upload(
    matterId: string,
    file: Express.Multer.File,
    user: User,
  ): Promise<Document> {
    const matter = await this.matterRepo.findOne({
      where: { id: matterId },
      relations: ['client'],
    });
    if (!matter) {
      throw new NotFoundException('Matter not found');
    }
    await this.assertMatterAccess(matter, user);
    if (!file || !file.path) {
      throw new BadRequestException('No file provided');
    }

    const doc = this.documentRepo.create({
      matterId,
      fileName: file.originalname,
      filePath: file.path,
      uploadedById: user.id,
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
    if (fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }
    await this.documentRepo.remove(doc);
  }

  getFilePath(doc: Document): string {
    return path.resolve(doc.filePath);
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
