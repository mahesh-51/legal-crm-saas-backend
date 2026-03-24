import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { DocumentsService } from './documents.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('matter/:matterId/upload')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath =
            process.env.UPLOAD_PATH ?? './uploads';
          const matterId = req.params.matterId;
          const dir = `${uploadPath}/matters/${matterId}`;
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueSuffix);
        },
      }),
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE ?? '10485760', 10),
      },
    }),
  )
  upload(
    @Param('matterId') matterId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.documentsService.upload(matterId, file, user);
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
