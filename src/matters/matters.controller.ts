import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MattersService } from './matters.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateMatterDto } from './dto/create-matter.dto';
import { UpdateMatterDto } from './dto/update-matter.dto';

@Controller('matters')
@UseGuards(JwtAuthGuard)
export class MattersController {
  constructor(private readonly mattersService: MattersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  create(
    @Body() dto: CreateMatterDto,
    @CurrentUser() user: User,
    @Query('firmId') firmId?: string,
  ) {
    return this.mattersService.create(dto, user, firmId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL, UserRole.CLIENT)
  findAll(
    @CurrentUser() user: User,
    @Query('firmId') firmId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.mattersService.findAll(user, firmId, clientId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL, UserRole.CLIENT)
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.mattersService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMatterDto,
    @CurrentUser() user: User,
  ) {
    return this.mattersService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.mattersService.remove(id, user);
  }
}
