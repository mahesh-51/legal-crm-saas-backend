import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FirmsService } from './firms.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateFirmDto } from './dto/create-firm.dto';
import { UpdateFirmDto } from './dto/update-firm.dto';

@Controller('firms')
@UseGuards(JwtAuthGuard)
export class FirmsController {
  constructor(private readonly firmsService: FirmsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.INDIVIDUAL)
  create(@Body() dto: CreateFirmDto, @CurrentUser('id') userId: string) {
    return this.firmsService.create(dto, userId);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.firmsService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.firmsService.findOne(id, user);
  }

  @Patch(':id/logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: memoryStorage(),
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE ?? '5242880', 10),
      },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new Error('Logo must be an image file'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.firmsService.uploadLogo(id, file, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFirmDto,
    @CurrentUser() user: User,
  ) {
    return this.firmsService.update(id, dto, user);
  }
}
