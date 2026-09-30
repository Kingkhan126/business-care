import { db } from "@/db/client";
import { VendorBillRepository } from "../repositories/VendorBillRepository";
import { SupplierRepository } from "../repositories/SupplierRepository";
import { WarehouseRepository } from "../repositories/WarehouseRepository";
import { ProductRepository } from "../repositories/ProductRepository";
import { InventoryService } from "./InventoryService";
import { CalculationEngine } from "./CalculationEngine";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { VendorBillInput } from "@/lib/validation/transactions";
import { BillStatus } from "@prisma/client";

export class VendorBillService {
  static async list(
    user: SessionUser,
    options?: { supplierId?: string; status?: BillStatus; search?: string; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "purchases.read");

    return VendorBillRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "purchases.read");

    const bill = await VendorBillRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!bill) {
      throw new NotFoundError("Vendor Bill not found");
    }
    return bill;
  }

  static async create(user: SessionUser, input: VendorBillInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "purchases.create");

    const supplier = await SupplierRepository.findByIdAndOrg(input.supplierId, user.activeOrganizationId);
    if (!supplier) {
      throw new NotFoundError("Supplier not found in your organization");
    }
    if (supplier.status !== "ACTIVE") {
      throw new ValidationError(`Supplier '${supplier.displayName}' is inactive.`);
    }

    if (input.warehouseId) {
      const warehouse = await WarehouseRepository.findByIdAndOrg(input.warehouseId, user.activeOrganizationId);
      if (!warehouse) {
        throw new NotFoundError("Warehouse not found in your organization");
      }
      if (!warehouse.isActive) {
        throw new ValidationError(`Warehouse '${warehouse.name}' is inactive.`);
      }
    }

    const calculated = CalculationEngine.calculateDocument(
      input.lines.map((l) => ({ ...l, unitPrice: l.unitPrice ?? (l as any).unitCost }))
    );

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await db.$transaction(async (tx) => {
          const count = await tx.vendorBill.count({ where: { organizationId: user.activeOrganizationId! } });
          const billNumber = `BILL-${String(count + 1 + attempts).padStart(6, "0")}`;

          const existing = await tx.vendorBill.findFirst({
            where: { billNumber, organizationId: user.activeOrganizationId! },
          });
          if (existing) {
            throw new Error("AUTO_NUMBER_COLLISION");
          }

          const bill = await tx.vendorBill.create({
            data: {
              organizationId: user.activeOrganizationId!,
              billNumber,
              supplierId: input.supplierId,
              sourcePurchaseOrderId: input.sourcePurchaseOrderId || null,
              warehouseId: input.warehouseId || null,
              vendorBillReference: input.vendorBillReference || null,
              issueDate: new Date(input.issueDate),
              dueDate: new Date(input.dueDate),
              status: "DRAFT",
              currency: input.currency || "USD",
              subtotal: calculated.subtotal,
              discountTotal: calculated.discountTotal,
              taxTotal: calculated.taxTotal,
              total: calculated.total,
              amountPaid: 0,
              balanceDue: calculated.total,
              notes: input.notes,
              terms: input.terms,
              createdById: user.id,
              lines: {
                create: calculated.lines.map((l, idx) => ({
                  productId: input.lines[idx].productId || null,
                  serviceId: input.lines[idx].serviceId || null,
                  description: l.description,
                  quantity: l.quantity,
                  unitOfMeasure: input.lines[idx].unitOfMeasure || null,
                  unitCost: l.unitPrice,
                  discount: l.discount,
                  taxRate: l.taxRate,
                  taxAmount: l.taxAmount,
                  subtotal: l.subtotal,
                  total: l.total,
                })),
              },
            },
            include: { lines: true, supplier: true },
          });

          await tx.auditLog.create({
            data: {
              organizationId: user.activeOrganizationId!,
              actorId: user.id,
              action: "vendor_bill.created",
              entityType: "VendorBill",
              entityId: bill.id,
              metadata: { billNumber, total: calculated.total },
            },
          });

          return bill;
        });
      } catch (err: any) {
        if (err.message === "AUTO_NUMBER_COLLISION") {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    throw new ConflictError("Failed to generate a unique bill number. Please try again.");
  }

  static async receiveBill(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "purchases.update");

    return db.$transaction(async (tx) => {
      // Row-level pessimistic lock on VendorBill to prevent double-receiving
      await tx.$queryRaw`SELECT id FROM "VendorBill" WHERE id = ${id} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;

      const bill = await tx.vendorBill.findFirst({
        where: { id, organizationId: user.activeOrganizationId! },
        include: { lines: true },
      });

      if (!bill) {
        throw new NotFoundError("Vendor Bill not found");
      }

      if (bill.status !== "DRAFT") {
        throw new ValidationError(`Only DRAFT vendor bills can be marked as received. Current status is '${bill.status}'.`);
      }

      let targetWarehouseId = bill.warehouseId;
      if (!targetWarehouseId) {
        const defaultWh = await WarehouseRepository.findDefaultByOrg(user.activeOrganizationId!);
        if (defaultWh) {
          targetWarehouseId = defaultWh.id;
        }
      }

      // Process inventory addition for physical products atomically inside transaction tx
      for (const line of bill.lines) {
        if (line.productId && targetWarehouseId) {
          const product = await ProductRepository.findByIdAndOrg(line.productId, user.activeOrganizationId!);
          if (product && product.trackInventory) {
            await InventoryService.adjustStock(
              user,
              {
                productId: line.productId,
                warehouseId: targetWarehouseId,
                adjustmentType: "CORRECTION",
                quantityChange: Number(line.quantity), // Add stock
                reason: `Vendor Bill ${bill.billNumber} Received`,
                notes: `Auto-added inventory for Bill ${bill.billNumber}`,
              },
              tx
            );
          }
        }
      }

      const updated = await tx.vendorBill.update({
        where: { id },
        data: {
          status: "RECEIVED",
          warehouseId: targetWarehouseId || bill.warehouseId,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "vendor_bill.received",
          entityType: "VendorBill",
          entityId: id,
          metadata: { billNumber: bill.billNumber, total: Number(bill.total) },
        },
      });

      return updated;
    });
  }

  static async voidBill(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "purchases.update");

    return db.$transaction(async (tx) => {
      // Row-level pessimistic lock on VendorBill to prevent concurrent voiding
      await tx.$queryRaw`SELECT id FROM "VendorBill" WHERE id = ${id} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;

      const bill = await tx.vendorBill.findFirst({
        where: { id, organizationId: user.activeOrganizationId! },
        include: { lines: true },
      });

      if (!bill) {
        throw new NotFoundError("Vendor Bill not found");
      }

      if (bill.status === "VOID" || bill.status === "PAID") {
        throw new ValidationError(`Vendor Bill ${bill.billNumber} in status '${bill.status}' cannot be voided.`);
      }

      // Reverse stock addition if bill was RECEIVED or PARTIALLY_PAID
      if ((bill.status === "RECEIVED" || bill.status === "PARTIALLY_PAID") && bill.warehouseId) {
        for (const line of bill.lines) {
          if (line.productId) {
            const product = await ProductRepository.findByIdAndOrg(line.productId, user.activeOrganizationId!);
            if (product && product.trackInventory) {
              await InventoryService.adjustStock(
                user,
                {
                  productId: line.productId,
                  warehouseId: bill.warehouseId,
                  adjustmentType: "CORRECTION",
                  quantityChange: -Number(line.quantity), // Deduct stock
                  reason: `Vendor Bill ${bill.billNumber} Voided`,
                  notes: `Auto-reversed inventory for voided Bill ${bill.billNumber}`,
                },
                tx
              );
            }
          }
        }
      }

      const updated = await tx.vendorBill.update({
        where: { id },
        data: {
          status: "VOID",
          balanceDue: 0,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "vendor_bill.voided",
          entityType: "VendorBill",
          entityId: id,
          metadata: { billNumber: bill.billNumber },
        },
      });

      return updated;
    });
  }
}
