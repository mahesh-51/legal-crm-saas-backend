import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, FirmUser, Invite } from '../database/entities';
import { InviteStatus } from '../common/enums/invite-status.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(FirmUser)
    private firmUserRepo: Repository<FirmUser>,
    @InjectRepository(Invite)
    private inviteRepo: Repository<Invite>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relationLoadStrategy: 'query',
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email', 'role', 'firmId', 'createdAt'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let modulePermissions: FirmUser['modulePermissions'] = [];
    let firmMembershipRole: FirmUser['role'] | null = null;
    if (user.firmId) {
      const membership = await this.firmUserRepo.findOne({
        where: { firmId: user.firmId, userId: user.id },
      });
      modulePermissions = membership?.modulePermissions ?? [];
      firmMembershipRole = membership?.role ?? null;
    }

    const acceptedInvite = await this.inviteRepo.findOne({
      where: [
        { acceptedByUserId: user.id, status: InviteStatus.ACCEPTED },
        {
          email: user.email,
          firmId: user.firmId ?? undefined,
          status: InviteStatus.ACCEPTED,
        },
      ],
      order: { acceptedAt: 'DESC', createdAt: 'DESC' },
      select: ['id', 'acceptedAt', 'status'],
    });

    const isInvitedUser = Boolean(acceptedInvite);
    const invitedUserMeta = {
      isInvitedUser,
      acceptedInviteId: acceptedInvite?.id ?? null,
      invitedAcceptedAt: acceptedInvite?.acceptedAt ?? null,
    };

    return {
      ...user,
      firmMembershipRole,
      modulePermissions,
      ...invitedUserMeta,
    };
  }
}
