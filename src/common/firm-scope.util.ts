import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { validate as uuidValidate } from 'uuid';
import { Firm, User } from '../database/entities';
import { UserRole } from './enums/user-role.enum';

export type FirmScope = {
  firmId: string | null;
  individualUserId: string | null;
};

/**
 * Resolves firm vs individual scope for firm dashboards and firm-scoped resources.
 * Same rules as GET /dashboard/overview (firmId required when user belongs to a firm).
 */
export async function resolveFirmScope(
  user: User,
  firmIdParam: string | undefined,
  firmRepo: Repository<Firm>,
): Promise<FirmScope> {
  if (user.role === UserRole.CLIENT) {
    throw new ForbiddenException('Access denied');
  }

  if (user.role === UserRole.INDIVIDUAL && !user.firmId) {
    if (firmIdParam) {
      throw new BadRequestException(
        'firmId must not be set for individual users without a firm',
      );
    }
    return { firmId: null, individualUserId: user.id };
  }

  if (!firmIdParam?.trim()) {
    throw new BadRequestException('firmId is required');
  }
  const firmId = firmIdParam.trim();
  if (!uuidValidate(firmId)) {
    throw new BadRequestException('firmId must be a valid UUID');
  }

  if (user.role === UserRole.SUPER_ADMIN) {
    const firm = await firmRepo.findOne({ where: { id: firmId } });
    if (!firm) {
      throw new NotFoundException('Firm not found');
    }
    return { firmId, individualUserId: null };
  }

  if (user.firmId !== firmId) {
    throw new ForbiddenException('Access denied to this firm');
  }

  return { firmId, individualUserId: null };
}
