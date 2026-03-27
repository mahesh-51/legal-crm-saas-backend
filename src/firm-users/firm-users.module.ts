import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirmUser, User, Firm, Invite } from '../database/entities';
import { FirmUsersService } from './firm-users.service';
import { FirmUsersController } from './firm-users.controller';
import { InvitesModule } from '../invites/invites.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FirmUser, User, Firm, Invite]),
    InvitesModule,
  ],
  controllers: [FirmUsersController],
  providers: [FirmUsersService],
  exports: [FirmUsersService],
})
export class FirmUsersModule {}
