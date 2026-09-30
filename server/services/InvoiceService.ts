import { db } from "@/db/client";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { CustomerRepository } from "../repositories/CustomerRepository";
import { WarehouseRepository } from "../repositories/WarehouseRepository";
import { ProductRepository } from "../repositories/ProductRepository";
import { InventoryService } from "./InventoryService";
import { CalculationEngine } from "./CalculationEngine";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { SalesInvoiceInput } from "@/lib/validation/transactions";
import { InvoiceStatus } from "@prisma/client";

export class InvoiceService {
  static async list(
    user: SessionUser,
    options?: { customerId?: string; status?: InvoiceStatus; search?: string; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "invoices.read");

    return InvoiceRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "invoices.read");

    const invoice = await InvoiceRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!invoice) {
      throw new NotFoundError("Sales Invoice not found");
    }
    return invoice;
  }

  static async create(user: SessionUser, input: SalesInvoiceInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "invoices.create");

    const customer = await CustomerRepository.findByIdAndOrg(input.customerId, user.activeOrganizationId);
    if (!customer) {
      throw new NotFoundError("Customer not found in your organization");
    }
    if (customer.status !== "ACTIVE") {
      throw new ValidationError(`Customer '${customer.displayName}' is inactive and cannot receive new invoices.`);
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

    const calculated = CalculationEngine.calculateDocument(input.lines);

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await db.$transaction(async (tx) => {
          const count = await tx.salesInvoice.count({ where: { organizationId: user.activeOrganizationId! } });
          const invoiceNumber = `INV-${String(count + 1 + attempts).padStart(6, "0")}`;

          const existing = await tx.salesInvoice.findFirst({
            where: { invoiceNumber, organizationId: user.activeOrganizationId! },
          });
          if (existing) {
            throw new Error("AUTO_NUMBER_COLLISION");
          }

          const invoice = await tx.salesInvoice.create({
            data: {
              organizationId: user.activeOrganizationId!,
              invoiceNumber,
              customerId: input.customerId,
              sourceSalesOrderId: input.sourceSalesOrderId || null,
              warehouseId: input.warehouseId || null,
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
              action: "invoice.created",
              entityType: "SalesInvoice",
              entityId: invoice.id,
              metadata: { invoiceNumber, total: calculated.total },
            },
          });

          return invoice;
        });
      } catch (err: any) {
        if (err.message === "AUTO_NUMBER_COLLISION") {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    throw new ConflictError("Failed to generate a unique invoice number. Please try again.");
  }

  static async issueInvoice(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "invoices.update");

    return db.$transaction(async (tx) => {
      // Row-level pessimistic lock on SalesInvoice to prevent double-issuing or race conditions
      await tx.$queryRaw`SELECT id FROM "SalesInvoice" WHERE id = ${id} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;

      const invoice = await tx.salesInvoice.findFirst({
        where: { id, organizationId: user.activeOrganizationId! },
        include: { lines: true },
      });

      if (!invoice) {
        throw new NotFoundError("Sales Invoice not found");
      }

      if (invoice.status !== "DRAFT") {
        throw new ValidationError(`Only DRAFT invoices can be issued. Current status is '${invoice.status}'.`);
      }

      // Resolve warehouse: either explicit invoice.warehouseId or default warehouse
      let targetWarehouseId = invoice.warehouseId;
      if (!targetWarehouseId) {
        const defaultWh = await WarehouseRepository.findDefaultByOrg(user.activeOrganizationId!);
        if (defaultWh) {
          targetWarehouseId = defaultWh.id;
        }
      }

      // Process inventory movements for inventoried physical products atomically inside transaction tx
      for (const line of invoice.lines) {
        if (line.productId && targetWarehouseId) {
          const product = await ProductRepository.findByIdAndOrg(line.productId, user.activeOrganizationId!);
          if (product && product.trackInventory) {
            await InventoryService.adjustStock(
              user,
              {
                productId: line.productId,
                warehouseId: targetWarehouseId,
                adjustmentType: "CORRECTION",
                quantityChange: -Number(line.quantity),
                reason: `Sales Invoice ${invoice.invoiceNumber} Issued`,
                notes: `Auto-deducted inventory for Invoice ${invoice.invoiceNumber}`,
              },
              tx
            );
          }
        }
      }

      const updated = await tx.salesInvoice.update({
        where: { id },
        data: {
          status: "ISSUED",
          warehouseId: targetWarehouseId || invoice.warehouseId,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "invoice.issued",
          entityType: "SalesInvoice",
          entityId: id,
          metadata: { invoiceNumber: invoice.invoiceNumber, total: Number(invoice.total) },
        },
      });

      return updated;
    });
  }

  static async voidInvoice(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "invoices.update");

    return db.$transaction(async (tx) => {
      // Row-level pessimistic lock on SalesInvoice to prevent concurrent voiding
      await tx.$queryRaw`SELECT id FROM "SalesInvoice" WHERE id = ${id} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;

      const invoice = await tx.salesInvoice.findFirst({
        where: { id, organizationId: user.activeOrganizationId! },
        include: { lines: true },
      });

      if (!invoice) {
        throw new NotFoundError("Sales Invoice not found");
      }

      if (invoice.status === "VOID" || invoice.status === "PAID") {
        throw new ValidationError(`Invoice ${invoice.invoiceNumber} in status '${invoice.status}' cannot be voided.`);
      }

      // Reverse inventory deduction if invoice was ISSUED or PARTIALLY_PAID
      if ((invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") && invoice.warehouseId) {
        for (const line of invoice.lines) {
          if (line.productId) {
            const product = await ProductRepository.findByIdAndOrg(line.productId, user.activeOrganizationId!);
            if (product && product.trackInventory) {
              await InventoryService.adjustStock(
                user,
                {
                  productId: line.productId,
                  warehouseId: invoice.warehouseId,
                  adjustmentType: "CORRECTION",
                  quantityChange: Number(line.quantity), // Re-add deducted quantity
                  reason: `Sales Invoice ${invoice.invoiceNumber} Voided`,
                  notes: `Auto-restored inventory for voided Invoice ${invoice.invoiceNumber}`,
                },
                tx
              );
            }
          }
        }
      }

      const updated = await tx.salesInvoice.update({
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
          action: "invoice.voided",
          entityType: "SalesInvoice",
          entityId: id,
          metadata: { invoiceNumber: invoice.invoiceNumber },
        },
      });

      return updated;
    });
  }
}
