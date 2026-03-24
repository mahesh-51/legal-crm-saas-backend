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
import { ClientsService } from './clients.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  create(
    @Body() dto: CreateClientDto,
    @CurrentUser() user: User,
    @Query('firmId') firmId?: string,
  ) {
    return this.clientsService.create(dto, user, firmId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL, UserRole.CLIENT)
  findAll(@CurrentUser() user: User, @Query('firmId') firmId?: string) {
    return this.clientsService.findAll(user, firmId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL, UserRole.CLIENT)
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.clientsService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: User,
  ) {
    return this.clientsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.clientsService.remove(id, user);
  }
}
