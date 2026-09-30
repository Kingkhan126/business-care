import { db } from "@/db/client";
import { SalesOrderRepository } from "../repositories/SalesOrderRepository";
import { CustomerRepository } from "../repositories/CustomerRepository";
import { CalculationEngine } from "./CalculationEngine";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { SalesOrderInput } from "@/lib/validation/transactions";
import { SalesOrderStatus } from "@prisma/client";

export class SalesOrderService {
  static async list(
    user: SessionUser,
    options?: { customerId?: string; status?: SalesOrderStatus; search?: string; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "orders.read");

    return SalesOrderRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "orders.read");

    const order = await SalesOrderRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!order) {
      throw new NotFoundError("Sales Order not found");
    }
    return order;
  }

  static async create(user: SessionUser, input: SalesOrderInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "orders.create");

    const customer = await CustomerRepository.findByIdAndOrg(input.customerId, user.activeOrganizationId);
    if (!customer) {
      throw new NotFoundError("Customer not found in your organization");
    }
    if (customer.status !== "ACTIVE") {
      throw new ValidationError(`Customer '${customer.displayName}' is inactive and cannot receive new sales orders.`);
    }

    const calculated = CalculationEngine.calculateDocument(input.lines);

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await db.$transaction(async (tx) => {
          const count = await tx.salesOrder.count({ where: { organizationId: user.activeOrganizationId! } });
          const orderNumber = `SO-${String(count + 1 + attempts).padStart(6, "0")}`;

          const existing = await tx.salesOrder.findFirst({
            where: { orderNumber, organizationId: user.activeOrganizationId! },
          });
          if (existing) {
            throw new Error("AUTO_NUMBER_COLLISION");
          }

          const order = await tx.salesOrder.create({
            data: {
              organizationId: user.activeOrganizationId!,
              orderNumber,
              customerId: input.customerId,
              sourceEstimateId: input.sourceEstimateId || null,
              orderDate: new Date(input.orderDate),
              expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : null,
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
                  unitPrice: l.unitPrice,
                  discount: l.discount,
                  taxRate: l.taxRate,
                  taxAmount: l.taxAmount,
                  subtotal: l.subtotal,
                  total: l.total,
                })),
              },
            },
            include: { lines: true, customer: true },
          });

          await tx.auditLog.create({
            data: {
              organizationId: user.activeOrganizationId!,
              actorId: user.id,
              action: "sales_order.created",
              entityType: "SalesOrder",
              entityId: order.id,
              metadata: { orderNumber, total: calculated.total },
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

    throw new ConflictError("Failed to generate a unique sales order number. Please try again.");
  }

  static async convertToInvoice(user: SessionUser, id: string, warehouseId?: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "invoices.create");

    return db.$transaction(async (tx) => {
      // Row-level pessimistic lock on SalesOrder to prevent duplicate invoice conversions
      await tx.$queryRaw`SELECT id FROM "SalesOrder" WHERE id = ${id} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;

      const order = await tx.salesOrder.findFirst({
        where: { id, organizationId: user.activeOrganizationId! },
        include: { lines: true },
      });

      if (!order) {
        throw new NotFoundError("Sales Order not found");
      }

      if (order.status === "CANCELLED" || order.status === "COMPLETED") {
        throw new ValidationError(`Sales Order ${order.orderNumber} in status '${order.status}' cannot be converted to an invoice.`);
      }

      let attempts = 0;
      let invoiceNumber = "";
      while (attempts < 5) {
        const count = await tx.salesInvoice.count({ where: { organizationId: user.activeOrganizationId! } });
        invoiceNumber = `INV-${String(count + 1 + attempts).padStart(6, "0")}`;
        const existing = await tx.salesInvoice.findFirst({
          where: { invoiceNumber, organizationId: user.activeOrganizationId! },
        });
        if (!existing) break;
        attempts++;
      }

      const issueDate = new Date();
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default Net 30

      const invoice = await tx.salesInvoice.create({
        data: {
          organizationId: user.activeOrganizationId!,
          invoiceNumber,
          customerId: order.customerId,
          sourceSalesOrderId: order.id,
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
              unitPrice: l.unitPrice,
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

      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: "COMPLETED" },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "sales_order.converted_to_invoice",
          entityType: "SalesOrder",
          entityId: order.id,
          metadata: { orderNumber: order.orderNumber, invoiceNumber },
        },
      });

      return invoice;
    });
  }
}
