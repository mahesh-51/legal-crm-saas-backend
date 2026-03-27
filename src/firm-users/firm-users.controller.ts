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
import { FirmUsersService } from './firm-users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { InviteFirmUserDto } from './dto/invite-firm-user.dto';
import { UpdateModulePermissionsDto } from './dto/update-module-permissions.dto';

@Controller('firms/:firmId/users')
@UseGuards(JwtAuthGuard)
export class FirmUsersController {
  constructor(private readonly firmUsersService: FirmUsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.SUPER_ADMIN)
  findAll(@Param('firmId') firmId: string, @CurrentUser() user: User) {
    return this.firmUsersService.findAllByFirm(firmId, user);
  }

  @Post('invite')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.SUPER_ADMIN)
  invite(
    @Param('firmId') firmId: string,
    @Body() dto: InviteFirmUserDto,
    @CurrentUser() user: User,
  ) {
    return this.firmUsersService.inviteUser(firmId, dto, user);
  }

  @Delete(':userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.SUPER_ADMIN)
  remove(
    @Param('firmId') firmId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: User,
  ) {
    return this.firmUsersService.remove(firmId, userId, user);
  }

  @Patch(':userId/module-permissions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FIRM_ADMIN, UserRole.SUPER_ADMIN)
  updateModulePermissions(
    @Param('firmId') firmId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateModulePermissionsDto,
    @CurrentUser() user: User,
  ) {
    return this.firmUsersService.updateModulePermissions(
      firmId,
      userId,
      dto.modulePermissions,
      user,
    );
  }
}
