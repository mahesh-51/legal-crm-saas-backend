import { ForbiddenException } from '@nestjs/common';
import { User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';

export const COURT_SCOPE_GLOBAL = 'global';

export function tenantScopeFromKeys(
  firmId: string | null,
  userId: string | null,
): string {
  if (firmId) {
    return `f:${firmId}`;
  }
  if (userId) {
    return `u:${userId}`;
  }
  return COURT_SCOPE_GLOBAL;
}

export function applyCourtScope(
  row: { firmId: string | null; userId: string | null; tenantScope: string },
): void {
  row.tenantScope = tenantScopeFromKeys(row.firmId, row.userId);
}

export function resolveWriteScope(user: User): {
  firmId: string | null;
  userId: string | null;
} {
  if (user.role === UserRole.SUPER_ADMIN) {
    return { firmId: null, userId: null };
  }
  if (
    user.role === UserRole.FIRM_ADMIN ||
    user.role === UserRole.LAWYER
  ) {
    if (!user.firmId) {
      throw new ForbiddenException('Firm context required');
    }
    return { firmId: user.firmId, userId: null };
  }
  if (user.role === UserRole.INDIVIDUAL) {
    return { firmId: null, userId: user.id };
  }
  throw new ForbiddenException('You cannot modify court reference data');
}

export function isGlobalCourtRow(row: {
  firmId: string | null;
  userId: string | null;
}): boolean {
  return !row.firmId && !row.userId;
}

export function canUserMutateCourtRow(user: User, row: { firmId: string | null; userId: string | null }): boolean {
  if (user.role === UserRole.SUPER_ADMIN) {
    return true;
  }
  if (isGlobalCourtRow(row)) {
    return false;
  }
  if (
    user.role === UserRole.FIRM_ADMIN ||
    user.role === UserRole.LAWYER
  ) {
    return !!row.firmId && row.firmId === user.firmId;
  }
  if (user.role === UserRole.INDIVIDUAL) {
    return !!row.userId && row.userId === user.id;
  }
  return false;
}

export function userCanSeeCourtRow(
  user: User,
  row: { firmId: string | null; userId: string | null },
): boolean {
  if (user.role === UserRole.SUPER_ADMIN) {
    return true;
  }
  if (isGlobalCourtRow(row)) {
    return true;
  }
  if (row.firmId) {
    return user.firmId === row.firmId;
  }
  if (row.userId) {
    return user.id === row.userId;
  }
  return false;
}

/** Court type/name rows allowed when saving a matter (global + that matter's tenant). */
export function courtRowVisibleForMatterContext(
  row: { firmId: string | null; userId: string | null },
  matterFirmId: string | null,
  matterCreatedById: string,
): boolean {
  if (isGlobalCourtRow(row)) {
    return true;
  }
  if (matterFirmId) {
    return !!row.firmId && row.firmId === matterFirmId;
  }
  return !!row.userId && row.userId === matterCreatedById;
}
