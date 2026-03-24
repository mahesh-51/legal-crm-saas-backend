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
import { CourtNamesService } from './court-names.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateCourtNameDto } from './dto/create-court-name.dto';
import { UpdateCourtNameDto } from './dto/update-court-name.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../database/entities';

@Controller('court-names')
@UseGuards(JwtAuthGuard)
export class CourtNamesController {
  constructor(private readonly courtNamesService: CourtNamesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FIRM_ADMIN,
    UserRole.LAWYER,
    UserRole.INDIVIDUAL,
  )
  create(@Body() dto: CreateCourtNameDto, @CurrentUser() user: User) {
    return this.courtNamesService.create(dto, user);
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
  findAll(
    @CurrentUser() user: User,
    @Query('courtTypeId') courtTypeId?: string,
  ) {
    return this.courtNamesService.findAll(user, courtTypeId);
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
    return this.courtNamesService.findOne(id, user);
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
    @Body() dto: UpdateCourtNameDto,
    @CurrentUser() user: User,
  ) {
    return this.courtNamesService.update(id, dto, user);
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
    return this.courtNamesService.remove(id, user);
  }
}
