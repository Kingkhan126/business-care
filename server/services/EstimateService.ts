import { db } from "@/db/client";
import { EstimateRepository } from "../repositories/EstimateRepository";
import { CustomerRepository } from "../repositories/CustomerRepository";
import { CalculationEngine } from "./CalculationEngine";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { EstimateInput } from "@/lib/validation/transactions";
import { EstimateStatus } from "@prisma/client";

export class EstimateService {
  static async list(
    user: SessionUser,
    options?: { customerId?: string; status?: EstimateStatus; search?: string; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "estimates.read");

    return EstimateRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "estimates.read");

    const estimate = await EstimateRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!estimate) {
      throw new NotFoundError("Estimate not found");
    }
    return estimate;
  }

  static async create(user: SessionUser, input: EstimateInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "estimates.create");

    const customer = await CustomerRepository.findByIdAndOrg(input.customerId, user.activeOrganizationId);
    if (!customer) {
      throw new NotFoundError("Customer not found in your organization");
    }
    if (customer.status !== "ACTIVE") {
      throw new ValidationError(`Customer '${customer.displayName}' is inactive and cannot receive new estimates.`);
    }

    const calculated = CalculationEngine.calculateDocument(input.lines);

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await db.$transaction(async (tx) => {
          const count = await tx.estimate.count({ where: { organizationId: user.activeOrganizationId! } });
          const estimateNumber = `EST-${String(count + 1 + attempts).padStart(6, "0")}`;

          const existing = await tx.estimate.findFirst({
            where: { estimateNumber, organizationId: user.activeOrganizationId! },
          });
          if (existing) {
            throw new Error("AUTO_NUMBER_COLLISION");
          }

          const estimate = await tx.estimate.create({
            data: {
              organizationId: user.activeOrganizationId!,
              estimateNumber,
              customerId: input.customerId,
              issueDate: new Date(input.issueDate),
              expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
              status: "DRAFT",
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
              action: "estimate.created",
              entityType: "Estimate",
              entityId: estimate.id,
              metadata: { estimateNumber, total: calculated.total },
            },
          });

          return estimate;
        });
      } catch (err: any) {
        if (err.message === "AUTO_NUMBER_COLLISION") {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    throw new ConflictError("Failed to generate a unique estimate number. Please try again.");
  }

  static async updateStatus(user: SessionUser, id: string, newStatus: EstimateStatus) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "estimates.update");

    const estimate = await EstimateRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!estimate) {
      throw new NotFoundError("Estimate not found");
    }

    // Valid state transitions for manual update
    const validTransitions: Record<EstimateStatus, EstimateStatus[]> = {
      DRAFT: ["SENT", "CANCELLED"],
      SENT: ["ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"],
      ACCEPTED: ["CANCELLED"], // CONVERTED must be triggered via conversion methods
      DECLINED: ["DRAFT", "CANCELLED"],
      EXPIRED: ["DRAFT", "CANCELLED"],
      CONVERTED: [],
      CANCELLED: [],
    };

    if (newStatus === "CONVERTED") {
      throw new ValidationError("Direct manual status update to 'CONVERTED' is prohibited. Use the conversion workflow.");
    }

    const allowed = validTransitions[estimate.status as EstimateStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new ValidationError(
        `Invalid status transition from '${estimate.status}' to '${newStatus}' for Estimate ${estimate.estimateNumber}.`
      );
    }

    return db.$transaction(async (tx) => {
      const updated = await tx.estimate.update({
        where: { id },
        data: { status: newStatus },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: `estimate.${newStatus.toLowerCase()}`,
          entityType: "Estimate",
          entityId: id,
          metadata: { estimateNumber: estimate.estimateNumber, previousStatus: estimate.status, newStatus },
        },
      });

      return updated;
    });
  }

  static async convertToSalesOrder(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "orders.create");

    return db.$transaction(async (tx) => {
      // Row-level pessimistic lock on Estimate to prevent race conditions during concurrent conversion
      await tx.$queryRaw`SELECT id FROM "Estimate" WHERE id = ${id} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;

      const estimate = await tx.estimate.findFirst({
        where: { id, organizationId: user.activeOrganizationId! },
        include: { lines: true },
      });

      if (!estimate) {
        throw new NotFoundError("Estimate not found");
      }

      if (estimate.status !== "ACCEPTED") {
        throw new ValidationError(
          `Only ACCEPTED estimates can be converted to Sales Orders. Current status is '${estimate.status}'.`
        );
      }

      if (estimate.convertedSalesOrderId) {
        throw new ConflictError(`Estimate '${estimate.estimateNumber}' has already been converted.`);
      }

      let attempts = 0;
      let orderNumber = "";
      while (attempts < 5) {
        const count = await tx.salesOrder.count({ where: { organizationId: user.activeOrganizationId! } });
        orderNumber = `SO-${String(count + 1 + attempts).padStart(6, "0")}`;
        const existing = await tx.salesOrder.findFirst({
          where: { orderNumber, organizationId: user.activeOrganizationId! },
        });
        if (!existing) break;
        attempts++;
      }

      const salesOrder = await tx.salesOrder.create({
        data: {
          organizationId: user.activeOrganizationId!,
          orderNumber,
          customerId: estimate.customerId,
          sourceEstimateId: estimate.id,
          orderDate: new Date(),
          status: "CONFIRMED",
          currency: estimate.currency,
          subtotal: estimate.subtotal,
          discountTotal: estimate.discountTotal,
          taxTotal: estimate.taxTotal,
          total: estimate.total,
          notes: estimate.notes,
          terms: estimate.terms,
          createdById: user.id,
          lines: {
            create: estimate.lines.map((l) => ({
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

      await tx.estimate.update({
        where: { id: estimate.id },
        data: {
          status: "CONVERTED",
          convertedSalesOrderId: salesOrder.id,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "estimate.converted_to_sales_order",
          entityType: "Estimate",
          entityId: estimate.id,
          metadata: { estimateNumber: estimate.estimateNumber, salesOrderNumber: salesOrder.orderNumber },
        },
      });

      return salesOrder;
    });
  }

  static async convertToInvoice(user: SessionUser, id: string, warehouseId?: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "invoices.create");

    return db.$transaction(async (tx) => {
      // Row-level pessimistic lock on Estimate
      await tx.$queryRaw`SELECT id FROM "Estimate" WHERE id = ${id} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;

      const estimate = await tx.estimate.findFirst({
        where: { id, organizationId: user.activeOrganizationId! },
        include: { lines: true },
      });

      if (!estimate) {
        throw new NotFoundError("Estimate not found");
      }

      if (estimate.status !== "ACCEPTED") {
        throw new ValidationError(
          `Only ACCEPTED estimates can be converted to Invoices. Current status is '${estimate.status}'.`
        );
      }

      if (estimate.convertedSalesOrderId) {
        throw new ConflictError(`Estimate '${estimate.estimateNumber}' has already been converted.`);
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
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const invoice = await tx.salesInvoice.create({
        data: {
          organizationId: user.activeOrganizationId!,
          invoiceNumber,
          customerId: estimate.customerId,
          warehouseId: warehouseId || null,
          issueDate,
          dueDate,
          status: "DRAFT",
          currency: estimate.currency,
          subtotal: estimate.subtotal,
          discountTotal: estimate.discountTotal,
          taxTotal: estimate.taxTotal,
          total: estimate.total,
          amountPaid: 0,
          balanceDue: estimate.total,
          notes: estimate.notes,
          terms: estimate.terms,
          createdById: user.id,
          lines: {
            create: estimate.lines.map((l) => ({
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

      await tx.estimate.update({
        where: { id: estimate.id },
        data: {
          status: "CONVERTED",
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "estimate.converted_to_invoice",
          entityType: "Estimate",
          entityId: estimate.id,
          metadata: { estimateNumber: estimate.estimateNumber, invoiceNumber },
        },
      });

      return invoice;
    });
  }
}
