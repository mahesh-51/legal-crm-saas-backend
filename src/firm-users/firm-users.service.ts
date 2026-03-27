import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirmUser, User, Firm, Invite } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { FirmRole } from '../common/enums/firm-role.enum';
import { InviteFirmUserDto } from './dto/invite-firm-user.dto';
import { InvitesService } from '../invites/invites.service';
import { InviteStatus } from '../common/enums/invite-status.enum';
import { InviteRole } from '../common/enums/invite-role.enum';
import { ModulePermissionSelection } from '../common/types/module-permission.type';
import { MODULE_ACTIONS_CATALOG } from '../invites/constants/module-actions.catalog';

export interface FirmUserListItem {
  id: string;
  firmId: string;
  userId: string | null;
  email: string;
  name: string | null;
  role: FirmRole | InviteRole;
  status: InviteStatus;
  modulePermissions: ModulePermissionSelection[];
  inviteId: string | null;
  inviteToken: string | null;
  expiresAt: Date | null;
  acceptedAt: Date | null;
  createdAt: Date | null;
  user: User | null;
}

@Injectable()
export class FirmUsersService {
  constructor(
    @InjectRepository(FirmUser)
    private firmUserRepo: Repository<FirmUser>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Firm)
    private firmRepo: Repository<Firm>,
    @InjectRepository(Invite)
    private inviteRepo: Repository<Invite>,
    private invitesService: InvitesService,
  ) {}

  async findAllByFirm(firmId: string, user: User): Promise<FirmUserListItem[]> {
    await this.assertFirmAdminAccess(firmId, user);
    const [firmUsers, invites] = await Promise.all([
      this.firmUserRepo.find({
        where: { firmId },
        relations: ['user'],
      }),
      this.inviteRepo.find({
        where: { firmId },
        order: { createdAt: 'DESC' },
      }),
    ]);
    const teamInvites = invites.filter((invite) => invite.role !== InviteRole.CLIENT);

    const acceptedByUserId = new Set<string>();
    for (const invite of teamInvites) {
      if (invite.status === InviteStatus.ACCEPTED && invite.acceptedByUserId) {
        acceptedByUserId.add(invite.acceptedByUserId);
      }
    }

    const acceptedByEmail = new Set<string>();
    for (const membership of firmUsers) {
      if (acceptedByUserId.has(membership.userId) && membership.user?.email) {
        acceptedByEmail.add(membership.user.email.trim().toLowerCase());
      }
    }

    const acceptedRows = firmUsers.map((membership): FirmUserListItem => ({
      id: membership.id,
      firmId: membership.firmId,
      userId: membership.userId,
      email: membership.user?.email ?? '',
      name: membership.user?.name ?? null,
      role: membership.role,
      status: InviteStatus.ACCEPTED,
      modulePermissions: membership.modulePermissions ?? [],
      inviteId: null,
      inviteToken: null,
      expiresAt: null,
      acceptedAt: null,
      createdAt: membership.user?.createdAt ?? null,
      user: membership.user ?? null,
    }));

    const pendingOrOtherInviteRows = teamInvites
      .filter((invite) => {
        const isAccepted = invite.status === InviteStatus.ACCEPTED;
        const email = invite.email.trim().toLowerCase();
        return !isAccepted || !acceptedByEmail.has(email);
      })
      .map(
        (invite): FirmUserListItem => ({
          id: `invite-${invite.id}`,
          firmId: invite.firmId,
          userId: invite.acceptedByUserId,
          email: invite.email,
          name: null,
          role: invite.role,
          status: invite.status,
          modulePermissions: invite.modulePermissions ?? [],
          inviteId: invite.id,
          inviteToken: invite.token,
          expiresAt: invite.expiresAt,
          acceptedAt: invite.acceptedAt,
          createdAt: invite.createdAt,
          user: null,
        }),
      );

    const combined = [...acceptedRows, ...pendingOrOtherInviteRows];
    combined.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return combined;
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
      modulePermissions: dto.modulePermissions,
    });
  }

  async updateModulePermissions(
    firmId: string,
    userId: string,
    modulePermissions: ModulePermissionSelection[],
    currentUser: User,
  ) {
    await this.assertFirmAdminAccess(firmId, currentUser);
    const firmUser = await this.firmUserRepo.findOne({
      where: { firmId, userId },
      relations: ['user'],
    });
    if (!firmUser) {
      throw new NotFoundException('User not found in firm');
    }

    const normalized = this.normalizeModulePermissions(modulePermissions);
    firmUser.modulePermissions = normalized;
    const saved = await this.firmUserRepo.save(firmUser);

    return {
      message: 'Module permissions updated successfully',
      membership: saved,
    };
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

  private normalizeModulePermissions(
    input: ModulePermissionSelection[] | undefined,
  ): ModulePermissionSelection[] {
    if (!input || input.length === 0) {
      return [];
    }

    const allowedActionMap = new Map<string, Set<string>>();
    for (const item of MODULE_ACTIONS_CATALOG) {
      allowedActionMap.set(item.module, new Set(item.actions));
    }

    const normalized = new Map<string, Set<string>>();
    for (const row of input) {
      const moduleName = String(row.module || '').trim();
      if (!moduleName) {
        throw new BadRequestException('Module name is required in module permissions');
      }
      const moduleAllowedActions = allowedActionMap.get(moduleName);
      if (!moduleAllowedActions) {
        throw new BadRequestException(`Unsupported module: ${moduleName}`);
      }
      if (!Array.isArray(row.actions) || row.actions.length === 0) {
        throw new BadRequestException(
          `At least one action is required for module: ${moduleName}`,
        );
      }

      let moduleActionSet = normalized.get(moduleName);
      if (!moduleActionSet) {
        moduleActionSet = new Set<string>();
        normalized.set(moduleName, moduleActionSet);
      }

      for (const action of row.actions) {
        const actionName = String(action || '').trim();
        if (!moduleAllowedActions.has(actionName)) {
          throw new BadRequestException(
            `Unsupported action "${actionName}" for module "${moduleName}"`,
          );
        }
        moduleActionSet.add(actionName);
      }
    }

    return Array.from(normalized.entries()).map(
      ([module, actions]): ModulePermissionSelection => ({
        module,
        actions: Array.from(actions.values()).sort(),
      }),
    );
  }
}
