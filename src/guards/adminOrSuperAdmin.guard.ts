import { UserType } from 'generated/prisma/enums';

// Type guard for safe checking
export function isAdminOrSuperAdmin(
  type: UserType,
): type is (typeof UserType)[keyof typeof UserType] {
  return type === UserType.ADMIN || type === UserType.SUPER_ADMIN;
}
