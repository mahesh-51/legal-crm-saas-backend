import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import {
  User,
  Firm,
  FirmUser,
  Client,
  Invite,
  PasswordResetToken,
} from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { FirmRole } from '../common/enums/firm-role.enum';
import { InviteStatus } from '../common/enums/invite-status.enum';
import { InviteRole } from '../common/enums/invite-role.enum';
import { EmailService } from '../email/email.service';
import {
  LoginDto,
  SignupFirmDto,
  SignupIndividualDto,
  SignupClientDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Firm)
    private firmRepo: Repository<Firm>,
    @InjectRepository(FirmUser)
    private firmUserRepo: Repository<FirmUser>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(Invite)
    private inviteRepo: Repository<Invite>,
    @InjectRepository(PasswordResetToken)
    private resetTokenRepo: Repository<PasswordResetToken>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      select: ['id', 'email', 'password', 'name', 'role', 'firmId'],
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.generateToken(user);
  }

  async signupFirm(dto: SignupFirmDto) {
    const existingFirm = await this.firmRepo.findOne({
      where: { subdomain: dto.subdomain },
    });
    if (existingFirm) {
      throw new ConflictException('Subdomain already taken');
    }
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.adminEmail },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.adminPassword, 10);
    const user = this.userRepo.create({
      name: dto.adminName,
      email: dto.adminEmail,
      password: hashedPassword,
      role: UserRole.FIRM_ADMIN,
      firmId: null,
    });
    const savedUser = await this.userRepo.save(user);

    const firm = this.firmRepo.create({
      name: dto.firmName,
      subdomain: dto.subdomain,
      ownerId: savedUser.id,
    });
    const savedFirm = await this.firmRepo.save(firm);

    await this.userRepo.update(savedUser.id, { firmId: savedFirm.id });

    const firmUser = this.firmUserRepo.create({
      firmId: savedFirm.id,
      userId: savedUser.id,
      role: FirmRole.FIRM_ADMIN,
    });
    await this.firmUserRepo.save(firmUser);

    const userWithFirm = await this.userRepo.findOne({
      where: { id: savedUser.id },
    });
    return this.generateToken(userWithFirm!);
  }

  async signupIndividual(dto: SignupIndividualDto) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: UserRole.INDIVIDUAL,
      firmId: null,
    });
    const savedUser = await this.userRepo.save(user);
    return this.generateToken(savedUser);
  }

  async signupClient(dto: SignupClientDto) {
    const invite = await this.inviteRepo.findOne({
      where: {
        token: dto.inviteToken,
        status: InviteStatus.PENDING,
        email: dto.email,
      },
      relations: ['firm'],
    });

    if (!invite) {
      throw new BadRequestException('Invalid or expired invite');
    }
    if (new Date() > invite.expiresAt) {
      await this.inviteRepo.update(invite.id, { status: InviteStatus.EXPIRED });
      throw new BadRequestException('Invite has expired');
    }
    if (invite.role !== InviteRole.CLIENT) {
      throw new BadRequestException('This invite is not for client registration');
    }

    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: UserRole.CLIENT,
      firmId: invite.firmId,
    });
    const savedUser = await this.userRepo.save(user);

    // Find client linked to this invite
    const client = invite.clientId
      ? await this.clientRepo.findOne({ where: { id: invite.clientId } })
      : await this.clientRepo.findOne({
          where: { email: dto.email, firmId: invite.firmId },
        });
    if (client) {
      await this.clientRepo.update(client.id, {
        userId: savedUser.id,
        portalAccess: true,
      });
    }

    await this.inviteRepo.update(invite.id, { status: InviteStatus.ACCEPTED });

    return this.generateToken(savedUser);
  }

  private generateToken(user: User) {
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

  async validateUser(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    await this.resetTokenRepo.save({
      userId: user.id,
      token,
      expiresAt,
    });
    const frontendUrl = this.config.get('app.frontendUrl') || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/auth/reset-password?token=${token}`;
    await this.emailService.sendPasswordReset(dto.email, resetLink);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetToken = await this.resetTokenRepo.findOne({
      where: { token: dto.token },
      relations: ['user'],
    });
    if (!resetToken || new Date() > resetToken.expiresAt) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.update(resetToken.userId, { password: hashedPassword });
    await this.resetTokenRepo.remove(resetToken);
    return { message: 'Password reset successfully' };
  }
}
