import { db } from "@/db/client";
import { VendorCreditRepository } from "../repositories/VendorCreditRepository";
import { SupplierRepository } from "../repositories/SupplierRepository";
import { CalculationEngine } from "./CalculationEngine";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { VendorCreditInput } from "@/lib/validation/transactions";

export class VendorCreditService {
  static async list(
    user: SessionUser,
    options?: { supplierId?: string; search?: string; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "credits.read");

    return VendorCreditRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "credits.read");

    const vendorCredit = await VendorCreditRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!vendorCredit) {
      throw new NotFoundError("Vendor Credit not found");
    }
    return vendorCredit;
  }

  static async create(user: SessionUser, input: VendorCreditInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "credits.create");

    const supplier = await SupplierRepository.findByIdAndOrg(input.supplierId, user.activeOrganizationId);
    if (!supplier) {
      throw new NotFoundError("Supplier not found in your organization");
    }

    const calculated = CalculationEngine.calculateDocument(
      input.lines.map((l) => ({ ...l, unitPrice: l.unitPrice ?? (l as any).unitCost }))
    );

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await db.$transaction(async (tx) => {
          const count = await tx.vendorCredit.count({ where: { organizationId: user.activeOrganizationId! } });
          const vendorCreditNumber = `VC-${String(count + 1 + attempts).padStart(6, "0")}`;

          const existing = await tx.vendorCredit.findFirst({
            where: { vendorCreditNumber, organizationId: user.activeOrganizationId! },
          });
          if (existing) {
            throw new Error("AUTO_NUMBER_COLLISION");
          }

          const vendorCredit = await tx.vendorCredit.create({
            data: {
              organizationId: user.activeOrganizationId!,
              vendorCreditNumber,
              supplierId: input.supplierId,
              sourceBillId: input.sourceBillId || null,
              issueDate: new Date(input.issueDate),
              status: "DRAFT",
              subtotal: calculated.subtotal,
              taxTotal: calculated.taxTotal,
              total: calculated.total,
              reason: input.reason,
              notes: input.notes,
              createdById: user.id,
              lines: {
                create: calculated.lines.map((l, idx) => ({
                  productId: input.lines[idx].productId || null,
                  serviceId: input.lines[idx].serviceId || null,
                  description: l.description,
                  quantity: l.quantity,
                  unitOfMeasure: input.lines[idx].unitOfMeasure || null,
                  unitCost: l.unitPrice,
                  taxRate: l.taxRate,
                  taxAmount: l.taxAmount,
                  subtotal: l.subtotal,
                  total: l.total,
                })),
              },
            },
            include: { lines: true },
          });

          await tx.auditLog.create({
            data: {
              organizationId: user.activeOrganizationId!,
              actorId: user.id,
              action: "vendor_credit.created",
              entityType: "VendorCredit",
              entityId: vendorCredit.id,
              metadata: { vendorCreditNumber, total: calculated.total },
            },
          });

          return vendorCredit;
        });
      } catch (err: any) {
        if (err.message === "AUTO_NUMBER_COLLISION") {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    throw new ConflictError("Failed to generate a unique vendor credit number. Please try again.");
  }

  static async issueVendorCredit(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "credits.update");

    const vendorCredit = await VendorCreditRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!vendorCredit) {
      throw new NotFoundError("Vendor Credit not found");
    }

    if (vendorCredit.status !== "DRAFT") {
      throw new ValidationError(`Only DRAFT vendor credits can be issued. Current status is '${vendorCredit.status}'.`);
    }

    return db.$transaction(async (tx) => {
      const updated = await tx.vendorCredit.update({
        where: { id },
        data: { status: "ISSUED" },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "vendor_credit.issued",
          entityType: "VendorCredit",
          entityId: id,
          metadata: { vendorCreditNumber: vendorCredit.vendorCreditNumber, total: Number(vendorCredit.total) },
        },
      });

      return updated;
    });
  }
}
