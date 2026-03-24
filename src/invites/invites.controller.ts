import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CreateInviteDto } from './dto/create-invite.dto';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

class AcceptInviteDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @MinLength(6)
  password: string;
}

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get('token')
  @Public()
  getByToken(@Query('token') token: string) {
    return this.invitesService.getByToken(token);
  }

  @Post('client')
  @UseGuards(JwtAuthGuard)
  createClientInvite(@Body() dto: CreateInviteDto) {
    return this.invitesService.createClientInvite(dto);
  }

  @Post('accept')
  @Public()
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.invitesService.acceptFirmUserInvite(dto);
  }
}
