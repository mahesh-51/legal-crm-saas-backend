import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Invite, Firm, FirmUser, User } from '../database/entities';
import { InviteStatus } from '../common/enums/invite-status.enum';
import { InviteRole } from '../common/enums/invite-role.enum';
import { FirmRole } from '../common/enums/firm-role.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CreateInviteDto } from './dto/create-invite.dto';
import {
  getDefaultFirmAdminPermissions,
  MODULE_ACTIONS_CATALOG,
  ModuleActionCatalogItem,
} from './constants/module-actions.catalog';
import { ModulePermissionSelection } from '../common/types/module-permission.type';
import { JwtService } from '@nestjs/jwt';

interface CreateFirmUserInviteDto {
  firmId: string;
  email: string;
  role: FirmRole;
  modulePermissions?: ModulePermissionSelection[];
}

interface AcceptInviteDto {
  token: string;
  name: string;
  password: string;
}

@Injectable()
export class InvitesService {
  private readonly rateLimitWindowMs = 60_000;
  private readonly rateLimitMaxHits = 10;
  private readonly rateLimitStore = new Map<string, number[]>();

  constructor(
    @InjectRepository(Invite)
    private inviteRepo: Repository<Invite>,
    @InjectRepository(Firm)
    private firmRepo: Repository<Firm>,
    @InjectRepository(FirmUser)
    private firmUserRepo: Repository<FirmUser>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private dataSource: DataSource,
    private jwtService: JwtService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

  getModuleActionsCatalog(): ModuleActionCatalogItem[] {
    return MODULE_ACTIONS_CATALOG.map(
      (item: ModuleActionCatalogItem): ModuleActionCatalogItem => ({
        module: item.module,
        actions: [...item.actions],
      }),
    );
  }

  async createFirmUserInvite(dto: CreateFirmUserInviteDto) {
    const firm = await this.firmRepo.findOne({ where: { id: dto.firmId } });
    if (!firm) {
      throw new NotFoundException('Firm not found');
    }
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      const inFirm = await this.firmUserRepo.findOne({
        where: { firmId: dto.firmId, userId: existingUser.id },
      });
      if (inFirm) {
        throw new ConflictException('User is already a member of this firm');
      }
    }
    const existingInvite = await this.inviteRepo.findOne({
      where: {
        email: dto.email,
        firmId: dto.firmId,
        status: InviteStatus.PENDING,
      },
    });
    if (existingInvite) {
      throw new ConflictException('Pending invite already exists for this email');
    }

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const modulePermissions = this.normalizeModulePermissions(
      dto.modulePermissions,
      dto.role,
    );

    const invite = this.inviteRepo.create({
      email: dto.email,
      role: dto.role as unknown as InviteRole,
      firmId: dto.firmId,
      modulePermissions,
      token,
      expiresAt,
    });
    const saved = await this.inviteRepo.save(invite);

    const frontendUrl = this.config.get('app.frontendUrl');
    const inviteLink = `${frontendUrl}/auth/accept-invite?token=${token}`;
    await this.emailService.sendInvite(
      dto.email,
      inviteLink,
      dto.role,
      firm.name,
    );

    return { invite: saved, message: 'Invite sent successfully' };
  }

  async createClientInvite(dto: CreateInviteDto) {
    const firm = await this.firmRepo.findOne({ where: { id: dto.firmId } });
    if (!firm) {
      throw new NotFoundException('Firm not found');
    }
    const existingInvite = await this.inviteRepo.findOne({
      where: {
        email: dto.email,
        firmId: dto.firmId,
        role: InviteRole.CLIENT,
        status: InviteStatus.PENDING,
      },
    });
    if (existingInvite) {
      throw new ConflictException('Pending invite already exists for this client');
    }

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = this.inviteRepo.create({
      email: dto.email,
      role: InviteRole.CLIENT,
      firmId: dto.firmId,
      clientId: dto.clientId ?? null,
      token,
      expiresAt,
    });
    const saved = await this.inviteRepo.save(invite);

    const frontendUrl = this.config.get('app.frontendUrl');
    const inviteLink = `${frontendUrl}/auth/signup/client?token=${token}`;
    await this.emailService.sendClientInvite(dto.email, inviteLink, firm.name);

    return { invite: saved, message: 'Client invite sent successfully' };
  }

  async getByToken(token: string) {
    this.assertRateLimit('invite-token', token);
    const invite = await this.findValidInviteOrThrow(token);
    const existingUser = await this.userRepo.findOne({
      where: { email: invite.email },
      select: ['id'],
    });

    return {
      token: invite.token,
      email: invite.email,
      role: invite.role,
      firmId: invite.firmId,
      modulePermissions: this.normalizeModulePermissions(
        invite.modulePermissions ?? undefined,
        invite.role === InviteRole.FIRM_ADMIN ? FirmRole.FIRM_ADMIN : FirmRole.LAWYER,
      ),
      isEmailRegistered: Boolean(existingUser),
    };
  }

  async acceptFirmUserInvite(dto: AcceptInviteDto) {
    this.assertRateLimit('accept-new', dto.token);
    const invite = await this.findValidInviteOrThrow(dto.token);
    if (invite.role === InviteRole.CLIENT) {
      throw new BadRequestException('Use client signup endpoint for this invite');
    }

    const existingUser = await this.userRepo.findOne({
      where: { email: invite.email },
      select: ['id'],
    });
    if (existingUser) {
      throw new ConflictException(
        'Email is already registered. Please login and use /invites/accept-existing.',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const firmRole = invite.role === InviteRole.FIRM_ADMIN ? FirmRole.FIRM_ADMIN : FirmRole.LAWYER;
    const userRole = invite.role === InviteRole.FIRM_ADMIN ? UserRole.FIRM_ADMIN : UserRole.LAWYER;
    const modulePermissions = this.normalizeModulePermissions(
      invite.modulePermissions ?? undefined,
      firmRole,
    );

    const savedUser = await this.dataSource.transaction(async (manager) => {
      const createdUser = manager.create(User, {
        name: dto.name,
        email: invite.email,
        password: hashedPassword,
        role: userRole,
        firmId: invite.firmId,
      });
      const user = await manager.save(User, createdUser);

      const firmUser = manager.create(FirmUser, {
        firmId: invite.firmId,
        userId: user.id,
        role: firmRole,
        modulePermissions,
      });
      await manager.save(FirmUser, firmUser);

      invite.status = InviteStatus.ACCEPTED;
      invite.acceptedAt = new Date();
      invite.acceptedByUserId = user.id;
      await manager.save(Invite, invite);

      return user;
    });

    return {
      ...this.generateAuthResponse(savedUser),
      message: 'Invite accepted successfully',
    };
  }

  async acceptExistingUserInvite(token: string, currentUser: User) {
    this.assertRateLimit('accept-existing', `${token}:${currentUser.id}`);
    const invite = await this.findValidInviteOrThrow(token);
    if (invite.role === InviteRole.CLIENT) {
      throw new BadRequestException('Use client signup endpoint for this invite');
    }

    const inviteEmail = invite.email.trim().toLowerCase();
    const userEmail = currentUser.email.trim().toLowerCase();
    if (inviteEmail !== userEmail) {
      throw new ForbiddenException('Authenticated user email does not match invite email');
    }

    const firmRole = invite.role === InviteRole.FIRM_ADMIN ? FirmRole.FIRM_ADMIN : FirmRole.LAWYER;
    const modulePermissions = this.normalizeModulePermissions(
      invite.modulePermissions ?? undefined,
      firmRole,
    );

    const response = await this.dataSource.transaction(async (manager) => {
      let firmUser = await manager.findOne(FirmUser, {
        where: { firmId: invite.firmId, userId: currentUser.id },
      });

      if (!firmUser) {
        firmUser = manager.create(FirmUser, {
          firmId: invite.firmId,
          userId: currentUser.id,
          role: firmRole,
          modulePermissions,
        });
        firmUser = await manager.save(FirmUser, firmUser);
      } else {
        firmUser.role = firmRole;
        firmUser.modulePermissions = modulePermissions;
        firmUser = await manager.save(FirmUser, firmUser);
      }

      const targetUserRole =
        invite.role === InviteRole.FIRM_ADMIN ? UserRole.FIRM_ADMIN : currentUser.role;
      await manager.update(User, { id: currentUser.id }, { firmId: invite.firmId, role: targetUserRole });

      invite.status = InviteStatus.ACCEPTED;
      invite.acceptedAt = new Date();
      invite.acceptedByUserId = currentUser.id;
      await manager.save(Invite, invite);

      return firmUser;
    });

    return {
      message: 'Invite accepted successfully',
      membership: response,
    };
  }

  private async findValidInviteOrThrow(token: string): Promise<Invite> {
    const invite = await this.inviteRepo.findOne({
      where: { token },
      relations: ['firm'],
    });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status === InviteStatus.ACCEPTED) {
      throw new ConflictException('Invite already accepted');
    }
    if (invite.status === InviteStatus.REVOKED) {
      throw new BadRequestException('Invite has been revoked');
    }
    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Invite is not active');
    }

    if (new Date() > invite.expiresAt) {
      await this.inviteRepo.update(invite.id, { status: InviteStatus.EXPIRED });
      throw new BadRequestException('Invite has expired');
    }
    return invite;
  }

  private assertRateLimit(scope: string, identifier: string): void {
    const key = `${scope}:${identifier}`;
    const now = Date.now();
    const existing = this.rateLimitStore.get(key) ?? [];
    const recent = existing.filter((ts) => now - ts < this.rateLimitWindowMs);
    if (recent.length >= this.rateLimitMaxHits) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.rateLimitStore.set(key, recent);
  }

  private generateAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        firmId: user.firmId,
      },
    };
  }

  private normalizeModulePermissions(
    input: ModulePermissionSelection[] | undefined,
    role: FirmRole,
  ): ModulePermissionSelection[] {
    if ((!input || input.length === 0) && role === FirmRole.FIRM_ADMIN) {
      return getDefaultFirmAdminPermissions();
    }
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
