import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentsService } from './documents.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { DocumentCategory } from '../common/enums/document-category.enum';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('matter/:matterId/upload')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE ?? '10485760', 10),
      },
      fileFilter: (req, file, cb) => {
        const cat = (req.query?.category as string) || 'GENERAL';
        if (cat === 'CASE_FILE') {
          const ok =
            file.mimetype === 'application/pdf' ||
            file.mimetype === 'application/msword' ||
            file.mimetype ===
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          if (!ok) {
            return cb(
              new Error(
                'Case file must be PDF or Word document (.pdf, .doc, .docx)',
              ),
              false,
            );
          }
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @Param('matterId') matterId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Query('category') category?: string,
  ) {
    const cat =
      category === 'CASE_FILE'
        ? DocumentCategory.CASE_FILE
        : DocumentCategory.GENERAL;
    return this.documentsService.upload(matterId, file, user, cat);
  }

  @Get('matter/:matterId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL, UserRole.CLIENT)
  findByMatter(
    @Param('matterId') matterId: string,
    @CurrentUser() user: User,
  ) {
    return this.documentsService.findByMatter(matterId, user);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL, UserRole.CLIENT)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.documentsService.findOne(id, user);
  }

  @Get(':id/download')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL, UserRole.CLIENT)
  async download(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: User,
  ) {
    const doc = await this.documentsService.findOne(id, user);
    if (this.documentsService.isRemoteUrl(doc.filePath)) {
      return res.redirect(doc.filePath);
    }
    const filePath = this.documentsService.getFilePath(doc);
    res.download(filePath, doc.fileName);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.documentsService.remove(id, user);
  }
}
