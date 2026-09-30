import { db } from "@/db/client";
import { ServiceRepository } from "../repositories/ServiceRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { ServiceInput } from "@/lib/validation/master_data";
import { ProductStatus } from "@prisma/client";

export class ServiceItemService {
  static async list(
    user: SessionUser,
    options?: { search?: string; status?: ProductStatus; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.read");

    return ServiceRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.read");

    const service = await ServiceRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!service) {
      throw new NotFoundError("Service item not found");
    }
    return service;
  }

  static async create(user: SessionUser, input: ServiceInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.create");

    return db.$transaction(async (tx) => {
      const existingCode = await tx.service.findFirst({
        where: { code: input.code, organizationId: user.activeOrganizationId! },
      });
      if (existingCode) {
        throw new ConflictError(`Service code '${input.code}' already exists in your organization.`);
      }

      const service = await tx.service.create({
        data: {
          organizationId: user.activeOrganizationId!,
          code: input.code,
          name: input.name,
          description: input.description,
          categoryId: input.categoryId || null,
          unitOfMeasureId: input.unitOfMeasureId || null,
          costPrice: input.costPrice,
          sellingPrice: input.sellingPrice,
          currency: input.currency,
          status: input.status,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "service.created",
          entityType: "Service",
          entityId: service.id,
          metadata: { code: service.code, name: service.name },
        },
      });

      return service;
    });
  }

  static async update(user: SessionUser, id: string, input: Partial<ServiceInput>) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "products.update");

    const existing = await ServiceRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!existing) {
      throw new NotFoundError("Service not found in your organization");
    }

    return db.$transaction(async (tx) => {
      if (input.code && input.code !== existing.code) {
        const duplicateCode = await tx.service.findFirst({
          where: { code: input.code, organizationId: user.activeOrganizationId! },
        });
        if (duplicateCode) {
          throw new ConflictError(`Service code '${input.code}' is already in use by another service.`);
        }
      }

      const updated = await tx.service.update({
        where: { id },
        data: {
          ...input,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "service.updated",
          entityType: "Service",
          entityId: id,
          metadata: { name: updated.name },
        },
      });

      return updated;
    });
  }
}
