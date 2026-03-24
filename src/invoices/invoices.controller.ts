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
import { InvoicesService } from './invoices.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: User) {
    return this.invoicesService.create(dto, user);
  }

  @Get('matter/:matterId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL, UserRole.CLIENT)
  findByMatter(
    @Param('matterId') matterId: string,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.findByMatter(matterId, user);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL, UserRole.CLIENT)
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.invoicesService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.LAWYER, UserRole.INDIVIDUAL)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.invoicesService.remove(id, user);
  }
}
