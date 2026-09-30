import { db } from "@/db/client";
import { PurchaseOrderRepository } from "../repositories/PurchaseOrderRepository";
import { SupplierRepository } from "../repositories/SupplierRepository";
import { CalculationEngine } from "./CalculationEngine";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { PurchaseOrderInput } from "@/lib/validation/transactions";
import { PurchaseOrderStatus } from "@prisma/client";

export class PurchaseOrderService {
  static async list(
    user: SessionUser,
    options?: { supplierId?: string; status?: PurchaseOrderStatus; search?: string; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "purchases.read");

    return PurchaseOrderRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "purchases.read");

    const order = await PurchaseOrderRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!order) {
      throw new NotFoundError("Purchase Order not found");
    }
    return order;
  }

  static async create(user: SessionUser, input: PurchaseOrderInput) {
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

    const calculated = CalculationEngine.calculateDocument(
      input.lines.map((l) => ({ ...l, unitPrice: l.unitPrice ?? (l as any).unitCost }))
    );

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await db.$transaction(async (tx) => {
          const count = await tx.purchaseOrder.count({ where: { organizationId: user.activeOrganizationId! } });
          const purchaseOrderNumber = `PO-${String(count + 1 + attempts).padStart(6, "0")}`;

          const existing = await tx.purchaseOrder.findFirst({
            where: { purchaseOrderNumber, organizationId: user.activeOrganizationId! },
          });
          if (existing) {
            throw new Error("AUTO_NUMBER_COLLISION");
          }

          const order = await tx.purchaseOrder.create({
            data: {
              organizationId: user.activeOrganizationId!,
              purchaseOrderNumber,
              supplierId: input.supplierId,
              orderDate: new Date(input.orderDate),
              expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
              status: "CONFIRMED",
              currency: input.currency || "USD",
              subtotal: calculated.subtotal,
              discountTotal: calculated.discountTotal,
              taxTotal: calculated.taxTotal,
              total: calculated.total,
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
              action: "purchase_order.created",
              entityType: "PurchaseOrder",
              entityId: order.id,
              metadata: { purchaseOrderNumber, total: calculated.total },
            },
          });

          return order;
        });
      } catch (err: any) {
        if (err.message === "AUTO_NUMBER_COLLISION") {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    throw new ConflictError("Failed to generate a unique purchase order number. Please try again.");
  }

  static async convertToVendorBill(user: SessionUser, id: string, warehouseId?: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "purchases.create");

    return db.$transaction(async (tx) => {
      // Row-level pessimistic lock on PurchaseOrder to prevent duplicate bill conversions
      await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${id} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;

      const order = await tx.purchaseOrder.findFirst({
        where: { id, organizationId: user.activeOrganizationId! },
        include: { lines: true },
      });

      if (!order) {
        throw new NotFoundError("Purchase Order not found");
      }

      if (order.status === "CANCELLED" || order.status === "COMPLETED") {
        throw new ValidationError(`Purchase Order ${order.purchaseOrderNumber} in status '${order.status}' cannot be converted.`);
      }

      let attempts = 0;
      let billNumber = "";
      while (attempts < 5) {
        const count = await tx.vendorBill.count({ where: { organizationId: user.activeOrganizationId! } });
        billNumber = `BILL-${String(count + 1 + attempts).padStart(6, "0")}`;
        const existing = await tx.vendorBill.findFirst({
          where: { billNumber, organizationId: user.activeOrganizationId! },
        });
        if (!existing) break;
        attempts++;
      }

      const issueDate = new Date();
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const bill = await tx.vendorBill.create({
        data: {
          organizationId: user.activeOrganizationId!,
          billNumber,
          supplierId: order.supplierId,
          sourcePurchaseOrderId: order.id,
          warehouseId: warehouseId || null,
          issueDate,
          dueDate,
          status: "DRAFT",
          currency: order.currency,
          subtotal: order.subtotal,
          discountTotal: order.discountTotal,
          taxTotal: order.taxTotal,
          total: order.total,
          amountPaid: 0,
          balanceDue: order.total,
          notes: order.notes,
          terms: order.terms,
          createdById: user.id,
          lines: {
            create: order.lines.map((l) => ({
              productId: l.productId,
              serviceId: l.serviceId,
              description: l.description,
              quantity: l.quantity,
              unitOfMeasure: l.unitOfMeasure,
              unitCost: l.unitCost,
              discount: l.discount,
              taxRate: l.taxRate,
              taxAmount: l.taxAmount,
              subtotal: l.subtotal,
              total: l.total,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: "COMPLETED" },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "purchase_order.converted_to_vendor_bill",
          entityType: "PurchaseOrder",
          entityId: order.id,
          metadata: { purchaseOrderNumber: order.purchaseOrderNumber, billNumber },
        },
      });

      return bill;
    });
  }
}
