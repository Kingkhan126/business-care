import { db } from "@/db/client";
import { RoleRepository } from "../repositories/RoleRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { CreateCustomRoleInput, UpdateCustomRoleInput } from "@/lib/validation/organization_settings";

export class RoleService {
  static async listRoles(user: SessionUser) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "users.view");

    return RoleRepository.listAvailableRolesForOrg(user.activeOrganizationId);
  }

  static async listAllPermissions(user: SessionUser) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    return db.permission.findMany({
      orderBy: [{ category: "asc" }, { code: "asc" }],
    });
  }

  static async createCustomRole(user: SessionUser, input: CreateCustomRoleInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "users.manage");

    const existingRole = await RoleRepository.findByName(input.name, user.activeOrganizationId);
    if (existingRole) {
      throw new ConflictError(`A role named '${input.name}' already exists in your organization.`);
    }

    return db.$transaction(async (tx) => {
      const createdRole = await tx.role.create({
        data: {
          organizationId: user.activeOrganizationId!,
          name: input.name,
          description: input.description,
          isSystem: false,
        },
      });

      const permissions = await tx.permission.findMany({
        where: { code: { in: input.permissionCodes } },
      });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: createdRole.id,
            permissionId: p.id,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "role.created",
          entityType: "Role",
          entityId: createdRole.id,
          metadata: { roleName: createdRole.name, permissionCount: permissions.length },
        },
      });

      return createdRole;
    });
  }

  static async updateCustomRole(user: SessionUser, input: UpdateCustomRoleInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "users.manage");

    const targetRole = await RoleRepository.findByIdAndOrg(input.roleId, user.activeOrganizationId);
    if (!targetRole) {
      throw new NotFoundError("Role not found in your organization");
    }

    if (targetRole.isSystem) {
      throw new ValidationError("System default roles (Owner, Admin, Manager, etc.) cannot be modified.");
    }

    return db.$transaction(async (tx) => {
      const updatedRole = await tx.role.update({
        where: { id: input.roleId },
        data: {
          name: input.name,
          description: input.description,
        },
      });

      await tx.rolePermission.deleteMany({ where: { roleId: input.roleId } });

      const permissions = await tx.permission.findMany({
        where: { code: { in: input.permissionCodes } },
      });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: input.roleId,
            permissionId: p.id,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "role.updated",
          entityType: "Role",
          entityId: input.roleId,
          metadata: { roleName: input.name, permissionCount: permissions.length },
        },
      });

      return updatedRole;
    });
  }

  static async deleteCustomRole(user: SessionUser, roleId: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "users.manage");

    const targetRole = await RoleRepository.findByIdAndOrg(roleId, user.activeOrganizationId);
    if (!targetRole) {
      throw new NotFoundError("Role not found in your organization");
    }

    if (targetRole.isSystem) {
      throw new ValidationError("System default roles cannot be deleted.");
    }

    const membersAssigned = await db.organizationMember.count({
      where: { roleId, organizationId: user.activeOrganizationId },
    });

    if (membersAssigned > 0) {
      throw new ValidationError(
        `Cannot delete role '${targetRole.name}' because it is assigned to ${membersAssigned} active member(s). Reassign them first.`
      );
    }

    await db.role.delete({ where: { id: roleId } });

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: "role.deleted",
      entityType: "Role",
      entityId: roleId,
      metadata: { deletedRoleName: targetRole.name },
    });

    return { success: true };
  }
}
