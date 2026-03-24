import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirmUser, User, Firm } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { FirmRole } from '../common/enums/firm-role.enum';
import { InviteFirmUserDto } from './dto/invite-firm-user.dto';
import { InvitesService } from '../invites/invites.service';

@Injectable()
export class FirmUsersService {
  constructor(
    @InjectRepository(FirmUser)
    private firmUserRepo: Repository<FirmUser>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Firm)
    private firmRepo: Repository<Firm>,
    private invitesService: InvitesService,
  ) {}

  async findAllByFirm(firmId: string, user: User): Promise<FirmUser[]> {
    await this.assertFirmAdminAccess(firmId, user);
    return this.firmUserRepo.find({
      where: { firmId },
      relations: ['user'],
    });
  }

  async remove(firmId: string, userId: string, currentUser: User): Promise<void> {
    await this.assertFirmAdminAccess(firmId, currentUser);
    const firmUser = await this.firmUserRepo.findOne({
      where: { firmId, userId },
    });
    if (!firmUser) {
      throw new NotFoundException('User not found in firm');
    }
    if (firmUser.role === FirmRole.FIRM_ADMIN) {
      const adminCount = await this.firmUserRepo.count({
        where: { firmId, role: FirmRole.FIRM_ADMIN },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException('Cannot remove the last firm admin');
      }
    }
    await this.firmUserRepo.remove(firmUser);
  }

  async inviteUser(firmId: string, dto: InviteFirmUserDto, user: User) {
    await this.assertFirmAdminAccess(firmId, user);
    const firm = await this.firmRepo.findOne({ where: { id: firmId } });
    if (!firm) {
      throw new NotFoundException('Firm not found');
    }
    return this.invitesService.createFirmUserInvite({
      firmId,
      email: dto.email,
      role: dto.role,
    });
  }

  private async assertFirmAdminAccess(firmId: string, user: User): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.firmId !== firmId) {
      throw new ForbiddenException('Access denied to this firm');
    }
    if (user.role !== UserRole.FIRM_ADMIN) {
      throw new ForbiddenException('Only firm admin can manage firm users');
    }
  }
}
