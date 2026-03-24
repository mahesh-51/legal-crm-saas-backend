import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

interface CreateFirmUserInviteDto {
  firmId: string;
  email: string;
  role: FirmRole;
}

interface AcceptInviteDto {
  token: string;
  name: string;
  password: string;
}

@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(Invite)
    private inviteRepo: Repository<Invite>,
    @InjectRepository(Firm)
    private firmRepo: Repository<Firm>,
    @InjectRepository(FirmUser)
    private firmUserRepo: Repository<FirmUser>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

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

    const invite = this.inviteRepo.create({
      email: dto.email,
      role: dto.role as unknown as InviteRole,
      firmId: dto.firmId,
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
    const invite = await this.inviteRepo.findOne({
      where: { token, status: InviteStatus.PENDING },
      relations: ['firm'],
    });
    if (!invite) {
      throw new BadRequestException('Invalid or expired invite');
    }
    if (new Date() > invite.expiresAt) {
      await this.inviteRepo.update(invite.id, { status: InviteStatus.EXPIRED });
      throw new BadRequestException('Invite has expired');
    }
    return invite;
  }

  async acceptFirmUserInvite(dto: AcceptInviteDto) {
    const invite = await this.inviteRepo.findOne({
      where: { token: dto.token, status: InviteStatus.PENDING },
      relations: ['firm'],
    });
    if (!invite) {
      throw new BadRequestException('Invalid or expired invite');
    }
    if (new Date() > invite.expiresAt) {
      await this.inviteRepo.update(invite.id, { status: InviteStatus.EXPIRED });
      throw new BadRequestException('Invite has expired');
    }
    if (invite.role === InviteRole.CLIENT) {
      throw new BadRequestException('Use client signup endpoint for this invite');
    }

    let user = await this.userRepo.findOne({
      where: { email: invite.email },
    });
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    if (!user) {
      user = this.userRepo.create({
        name: dto.name,
        email: invite.email,
        password: hashedPassword,
        role: invite.role === InviteRole.FIRM_ADMIN ? UserRole.FIRM_ADMIN : UserRole.LAWYER,
        firmId: invite.firmId,
      });
      user = await this.userRepo.save(user);
    } else {
      await this.userRepo.update(user.id, {
        firmId: invite.firmId,
        password: hashedPassword,
      });
      user.firmId = invite.firmId;
    }

    const firmUser = this.firmUserRepo.create({
      firmId: invite.firmId,
      userId: user.id,
      role: invite.role === InviteRole.FIRM_ADMIN ? FirmRole.FIRM_ADMIN : FirmRole.LAWYER,
    });
    await this.firmUserRepo.save(firmUser);

    await this.inviteRepo.update(invite.id, { status: InviteStatus.ACCEPTED });

    return { user, message: 'Invite accepted successfully' };
  }
}
