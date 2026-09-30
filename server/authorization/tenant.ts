import { SessionUser } from "@/types/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export function assertTenantAccess(user: SessionUser | null, targetOrganizationId: string): void {
  if (!user) {
    throw new UnauthorizedError("Authentication required");
  }

  if (!user.activeOrganizationId) {
    throw new ForbiddenError("User has no active organization selected");
  }

  if (user.activeOrganizationId !== targetOrganizationId) {
    throw new ForbiddenError(
      "Tenant Isolation Violation: Access denied to foreign organization data."
    );
  }
}

export function scopeOrganizationQuery<T extends { organizationId?: string }>(
  user: SessionUser,
  whereClause: T = {} as T
): T & { organizationId: string } {
  if (!user.activeOrganizationId) {
    throw new ForbiddenError("Cannot query tenant data without active organization context.");
  }

  return {
    ...whereClause,
    organizationId: user.activeOrganizationId,
  };
}
