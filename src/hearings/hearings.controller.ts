import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { HearingsService } from './hearings.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateHearingDto } from './dto/create-hearing.dto';
import { UpdateHearingDto } from './dto/update-hearing.dto';

@Controller('hearings')
@UseGuards(JwtAuthGuard)
export class HearingsController {
  constructor(private readonly hearingsService: HearingsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  create(@Body() dto: CreateHearingDto, @CurrentUser() user: User) {
    return this.hearingsService.create(dto, user);
  }

  @Get('matter/:matterId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL, UserRole.CLIENT)
  findByMatter(
    @Param('matterId') matterId: string,
    @CurrentUser() user: User,
  ) {
    return this.hearingsService.findByMatter(matterId, user);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL, UserRole.CLIENT)
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.hearingsService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHearingDto,
    @CurrentUser() user: User,
  ) {
    return this.hearingsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.hearingsService.remove(id, user);
  }
}
