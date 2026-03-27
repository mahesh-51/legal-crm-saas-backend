import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { Resend } from 'resend';

export interface SendMailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private transporter: Transporter | null = null;
  private resendClient: Resend | null = null;
  private resendFrom = '';
  private provider: 'smtp' | 'resend' = 'smtp';

  constructor(private config: ConfigService) {
    this.init();
  }

  private init() {
    const providerValue = this.config.get<string>('email.provider') || 'smtp';
    this.provider = providerValue === 'resend' ? 'resend' : 'smtp';

    const resendApiKey = this.config.get<string>('resend.apiKey');
    const resendFrom = this.config.get<string>('resend.from');
    if (resendApiKey) {
      this.resendClient = new Resend(resendApiKey);
      this.resendFrom = resendFrom || this.config.get<string>('email.from') || '';
    }

    const host = this.config.get('email.host');
    const user = this.config.get('email.user');
    if (host && user) {
      this.transporter = nodemailer.createTransport({
        host: this.config.get('email.host'),
        port: this.config.get('email.port'),
        secure: this.config.get('email.secure'),
        auth: {
          user: this.config.get('email.user'),
          pass: this.config.get('email.password'),
        },
      });
    }
  }

  async send(options: SendMailOptions): Promise<boolean> {
    if (this.provider === 'resend') {
      return this.sendViaResend(options);
    }

    return this.sendViaSmtp(options);
  }

  private async sendViaSmtp(options: SendMailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.warn('Email not configured. Skipping send:', options.subject);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.config.get('email.from'),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      return true;
    } catch (err) {
      console.error('Email send failed:', err);
      return false;
    }
  }

  async sendInvite(to: string, inviteLink: string, role: string, firmName: string) {
    const subject = `You're invited to join ${firmName}`;
    const html = `
      <h2>You're invited!</h2>
      <p>You've been invited to join <strong>${firmName}</strong> as a <strong>${role}</strong>.</p>
      <p><a href="${inviteLink}">Accept invitation</a></p>
      <p>This link expires in 7 days.</p>
      <p>If you didn't expect this email, you can safely ignore it.</p>
    `;
    const text = `You're invited to join ${firmName} as ${role}. Accept invitation: ${inviteLink}. This link expires in 7 days.`;

    return this.send({ to, subject, html, text });
  }

  async sendClientInvite(to: string, inviteLink: string, firmName: string) {
    const subject = `Portal access - ${firmName}`;
    const html = `
      <h2>Client Portal Access</h2>
      <p>You've been granted access to the client portal for <strong>${firmName}</strong>.</p>
      <p><a href="${inviteLink}">Set up your account</a></p>
      <p>This link expires in 7 days.</p>
    `;
    const text = `You have portal access for ${firmName}. Set up account: ${inviteLink}. This link expires in 7 days.`;

    return this.send({ to, subject, html, text });
  }

  async sendPasswordReset(to: string, resetLink: string) {
    return this.send({
      to,
      subject: 'Reset your password',
      html: `
        <h2>Password Reset</h2>
        <p><a href="${resetLink}">Reset your password</a></p>
        <p>This link expires in 1 hour.</p>
      `,
    });
  }

  async sendSignupConfirmation(to: string, name: string) {
    return this.send({
      to,
      subject: 'Welcome to Legal CRM',
      html: `
        <h2>Welcome, ${name}!</h2>
        <p>Your account has been created successfully.</p>
      `,
    });
  }

  private async sendViaResend(options: SendMailOptions): Promise<boolean> {
    if (!this.resendClient || !this.resendFrom) {
      console.warn(
        'Resend provider selected but RESEND_API_KEY/RESEND_FROM is missing. Skipping send:',
        options.subject,
      );
      return false;
    }

    try {
      await this.resendClient.emails.send({
        from: this.resendFrom,
        to: options.to,
        subject: options.subject,
        html: options.html ?? '',
        text: options.text ?? '',
      });
      return true;
    } catch (err) {
      console.error('Resend email send failed:', err);
      return false;
    }
  }
}
