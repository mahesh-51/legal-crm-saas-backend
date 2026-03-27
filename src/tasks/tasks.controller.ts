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
import { TasksService } from './tasks.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from '../common/enums/task-status.enum';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FIRM_ADMIN,
    UserRole.LAWYER,
    UserRole.INDIVIDUAL,
  )
  create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: User,
    @Query('firmId') firmId?: string,
  ) {
    return this.tasksService.create(dto, user, firmId);
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
    @Query('status') status?: TaskStatus,
    @Query('assigneeId') assigneeId?: string,
    @Query('kind') kind?: string,
  ) {
    return this.tasksService.findAll(user, firmId, {
      matterId,
      clientId,
      dailyListingId,
      status,
      assigneeId,
      kind,
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
    return this.tasksService.findOne(id, user);
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
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.update(id, dto, user);
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
    await this.tasksService.remove(id, user);
  }
}
