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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MeetingStatus } from '../common/enums/meeting-status.enum';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FIRM_ADMIN,
    UserRole.LAWYER,
    UserRole.INDIVIDUAL,
  )
  create(
    @Body() dto: CreateMeetingDto,
    @CurrentUser() user: User,
    @Query('firmId') firmId?: string,
  ) {
    return this.meetingsService.create(dto, user, firmId);
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
    @Query('firmId') firmId?: string,
    @Query('matterId') matterId?: string,
    @Query('clientId') clientId?: string,
    @Query('dailyListingId') dailyListingId?: string,
    @Query('status') status?: MeetingStatus,
    @Query('organizerId') organizerId?: string,
  ) {
    return this.meetingsService.findAll(user, firmId, {
      matterId,
      clientId,
      dailyListingId,
      status,
      organizerId,
    });
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
    return this.meetingsService.findOne(id, user);
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
    @Body() dto: UpdateMeetingDto,
    @CurrentUser() user: User,
  ) {
    return this.meetingsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FIRM_ADMIN,
    UserRole.LAWYER,
    UserRole.INDIVIDUAL,
  )
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.meetingsService.remove(id, user);
  }
}
