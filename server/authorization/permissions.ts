import { SessionUser } from "@/types/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export function hasPermission(user: SessionUser | null, requiredPermission: string): boolean {
  if (!user) return false;
  if (!user.permissions || user.permissions.length === 0) return false;
  return user.permissions.includes(requiredPermission);
}

export function hasAnyPermission(user: SessionUser | null, requiredPermissions: string[]): boolean {
  if (!user) return false;
  if (!user.permissions || user.permissions.length === 0) return false;
  return requiredPermissions.some((perm) => user.permissions.includes(perm));
}

export function hasAllPermissions(user: SessionUser | null, requiredPermissions: string[]): boolean {
  if (!user) return false;
  if (!user.permissions || user.permissions.length === 0) return false;
  return requiredPermissions.every((perm) => user.permissions.includes(perm));
}

export function requirePermission(user: SessionUser | null, requiredPermission: string): void {
  if (!user) {
    throw new UnauthorizedError("Authentication required");
  }

  if (!hasPermission(user, requiredPermission)) {
    throw new ForbiddenError(
      `Permission denied: Requires '${requiredPermission}' permission.`
    );
  }
}
