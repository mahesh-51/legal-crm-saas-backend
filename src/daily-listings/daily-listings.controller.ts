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
import { DailyListingsService } from './daily-listings.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateDailyListingDto } from './dto/create-daily-listing.dto';
import { UpdateDailyListingDto } from './dto/update-daily-listing.dto';

@Controller('daily-listings')
@UseGuards(JwtAuthGuard)
export class DailyListingsController {
  constructor(private readonly dailyListingsService: DailyListingsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  create(@Body() dto: CreateDailyListingDto, @CurrentUser() user: User) {
    return this.dailyListingsService.create(dto, user);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.FIRM_ADMIN,
    UserRole.LAWYER,
    UserRole.INDIVIDUAL,
    UserRole.CLIENT,
  )
  findAll(
    @CurrentUser() user: User,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dailyListingsService.findAll(user, {
      search,
      dateFrom,
      dateTo,
      page,
      limit,
    });
  }

  @Get('matter/:matterId')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.FIRM_ADMIN,
    UserRole.LAWYER,
    UserRole.INDIVIDUAL,
    UserRole.CLIENT,
  )
  findByMatter(
    @Param('matterId') matterId: string,
    @CurrentUser() user: User,
  ) {
    return this.dailyListingsService.findByMatter(matterId, user);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.FIRM_ADMIN,
    UserRole.LAWYER,
    UserRole.INDIVIDUAL,
    UserRole.CLIENT,
  )
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.dailyListingsService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDailyListingDto,
    @CurrentUser() user: User,
  ) {
    return this.dailyListingsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.dailyListingsService.remove(id, user);
  }
}
