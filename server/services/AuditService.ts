import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError } from "@/lib/errors";

export class AuditService {
  static async listAuditLogs(user: SessionUser, limit = 50) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "audit.read");

    return AuditRepository.listByOrganization(user.activeOrganizationId, limit);
  }
}
