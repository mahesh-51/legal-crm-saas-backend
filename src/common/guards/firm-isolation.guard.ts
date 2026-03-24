import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import { User } from '../../database/entities';

@Injectable()
export class FirmIsolationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as User;
    const firmId = request.params.firmId || request.params.id || request.body?.firmId;

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    // SUPER_ADMIN can access all
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Individual lawyers - no firm, skip firm check (handled by IndividualAccessGuard)
    if (user.role === UserRole.INDIVIDUAL) {
      return true;
    }

    // Clients - can only access their own data (handled by ClientAccessGuard)
    if (user.role === UserRole.CLIENT) {
      return true;
    }

    // Firm users must belong to the firm
    if (user.firmId && firmId && user.firmId !== firmId) {
      throw new ForbiddenException('Access denied to this firm');
    }

    return true;
  }
}
