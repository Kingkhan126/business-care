import { db } from "@/db/client";
import { SupplierRepository } from "../repositories/SupplierRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { SupplierInput } from "@/lib/validation/master_data";
import { SupplierStatus } from "@prisma/client";

export class SupplierService {
  static async list(
    user: SessionUser,
    options?: { search?: string; status?: SupplierStatus; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "vendors.read");

    return SupplierRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "vendors.read");

    const supplier = await SupplierRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!supplier) {
      throw new NotFoundError("Supplier not found");
    }
    return supplier;
  }

  static async create(user: SessionUser, input: SupplierInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "vendors.create");

    const userProvidedNumber = Boolean(input.supplierNumber?.trim());
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await db.$transaction(async (tx) => {
          let supplierNumber = input.supplierNumber?.trim();
          if (!supplierNumber) {
            const count = await tx.supplier.count({ where: { organizationId: user.activeOrganizationId! } });
            supplierNumber = `SUP-${String(count + 1 + attempts).padStart(6, "0")}`;
          }

          const existing = await tx.supplier.findFirst({
            where: { supplierNumber, organizationId: user.activeOrganizationId! },
          });
          if (existing) {
            if (userProvidedNumber) {
              throw new ConflictError(`Supplier number '${supplierNumber}' already exists in your organization.`);
            }
            throw new Error("AUTO_NUMBER_COLLISION");
          }

          const supplier = await tx.supplier.create({
            data: {
              organizationId: user.activeOrganizationId!,
              supplierNumber,
              displayName: input.displayName,
              legalName: input.legalName,
              contactPerson: input.contactPerson,
              email: input.email,
              phone: input.phone,
              alternatePhone: input.alternatePhone,
              website: input.website,
              addressLine1: input.addressLine1,
              addressLine2: input.addressLine2,
              city: input.city,
              state: input.state,
              postalCode: input.postalCode,
              country: input.country,
              taxId: input.taxId,
              registrationNumber: input.registrationNumber,
              currency: input.currency,
              paymentTerms: input.paymentTerms,
              notes: input.notes,
              status: input.status,
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId: user.activeOrganizationId!,
              actorId: user.id,
              action: "supplier.created",
              entityType: "Supplier",
              entityId: supplier.id,
              metadata: { supplierNumber, displayName: supplier.displayName },
            },
          });

          return supplier;
        });
      } catch (err: any) {
        if (err.message === "AUTO_NUMBER_COLLISION" && !userProvidedNumber) {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    throw new ConflictError("Failed to generate a unique supplier number after multiple attempts. Please try again.");
  }

  static async update(user: SessionUser, id: string, input: Partial<SupplierInput>) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "vendors.update");

    const existing = await SupplierRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!existing) {
      throw new NotFoundError("Supplier not found in your organization");
    }

    return db.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: {
          ...input,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "supplier.updated",
          entityType: "Supplier",
          entityId: id,
          metadata: { displayName: updated.displayName },
        },
      });

      return updated;
    });
  }

  static async updateStatus(user: SessionUser, id: string, status: SupplierStatus) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "vendors.update");

    const existing = await SupplierRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!existing) {
      throw new NotFoundError("Supplier not found in your organization");
    }

    return db.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: status === "ACTIVE" ? "supplier.reactivated" : "supplier.deactivated",
          entityType: "Supplier",
          entityId: id,
        },
      });

      return updated;
    });
  }
}
