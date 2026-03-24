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
import { CourtTypesService } from './court-types.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateCourtTypeDto } from './dto/create-court-type.dto';
import { UpdateCourtTypeDto } from './dto/update-court-type.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../database/entities';

@Controller('court-types')
@UseGuards(JwtAuthGuard)
export class CourtTypesController {
  constructor(private readonly courtTypesService: CourtTypesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FIRM_ADMIN,
    UserRole.LAWYER,
    UserRole.INDIVIDUAL,
  )
  create(@Body() dto: CreateCourtTypeDto, @CurrentUser() user: User) {
    return this.courtTypesService.create(dto, user);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FIRM_ADMIN,
    UserRole.LAWYER,
    UserRole.INDIVIDUAL,
    UserRole.CLIENT,
  )
  findAll(@CurrentUser() user: User) {
    return this.courtTypesService.findAll(user);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FIRM_ADMIN,
    UserRole.LAWYER,
    UserRole.INDIVIDUAL,
    UserRole.CLIENT,
  )
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.courtTypesService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FIRM_ADMIN,
    UserRole.LAWYER,
    UserRole.INDIVIDUAL,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourtTypeDto,
    @CurrentUser() user: User,
  ) {
    return this.courtTypesService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FIRM_ADMIN,
    UserRole.LAWYER,
    UserRole.INDIVIDUAL,
  )
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.courtTypesService.remove(id, user);
  }
}
