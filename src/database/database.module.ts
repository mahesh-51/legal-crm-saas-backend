import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { DataSourceOptions } from 'typeorm';
import {
  User,
  Firm,
  FirmUser,
  Client,
  CourtType,
  CourtName,
  Matter,
  DailyListing,
  Invoice,
  Document,
  Invite,
  Notification,
  PasswordResetToken,
  Task,
  Meeting,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbType = config.get('database.type') || 'mysql';
        const options = {
          type: dbType,
          host: config.get('database.host') || 'localhost',
          port: config.get('database.port') || 3306,
          username: config.get('database.username') || 'root',
          password: config.get('database.password') || '',
          database: String(config.get('database.database') || 'legal_crm'),
          entities: [
            User,
            Firm,
            FirmUser,
            Client,
            CourtType,
            CourtName,
            Matter,
            DailyListing,
            Invoice,
            Document,
            Invite,
            Notification,
            PasswordResetToken,
            Task,
            Meeting,
          ],
          synchronize: config.get('nodeEnv') === 'development',
          logging: config.get('nodeEnv') === 'development',
        };
        return options as DataSourceOptions;
      },
    }),
  ],
})
export class DatabaseModule {}
