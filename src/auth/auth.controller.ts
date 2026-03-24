import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import {
  LoginDto,
  SignupFirmDto,
  SignupIndividualDto,
  SignupClientDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('signup/firm')
  signupFirm(@Body() dto: SignupFirmDto) {
    return this.authService.signupFirm(dto);
  }

  @Public()
  @Post('signup/individual')
  signupIndividual(@Body() dto: SignupIndividualDto) {
    return this.authService.signupIndividual(dto);
  }

  @Public()
  @Post('signup/client')
  signupClient(@Body() dto: SignupClientDto) {
    return this.authService.signupClient(dto);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
