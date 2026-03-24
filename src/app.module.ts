import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FirmsModule } from './firms/firms.module';
import { FirmUsersModule } from './firm-users/firm-users.module';
import { ClientsModule } from './clients/clients.module';
import { CourtsModule } from './courts/courts.module';
import { MattersModule } from './matters/matters.module';
import { DailyListingsModule } from './daily-listings/daily-listings.module';
import { DocumentsModule } from './documents/documents.module';
import { InvoicesModule } from './invoices/invoices.module';
import { InvitesModule } from './invites/invites.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CloudinaryModule } from './cloudinary/cloudinary.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    CloudinaryModule,
    DatabaseModule,
    CommonModule,
    EmailModule,
    AuthModule,
    UsersModule,
    FirmsModule,
    FirmUsersModule,
    ClientsModule,
    CourtsModule,
    MattersModule,
    DailyListingsModule,
    DocumentsModule,
    InvoicesModule,
    InvitesModule,
    NotificationsModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
