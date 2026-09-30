import { db } from "@/db/client";
import { CreditNoteRepository } from "../repositories/CreditNoteRepository";
import { CustomerRepository } from "../repositories/CustomerRepository";
import { ProductRepository } from "../repositories/ProductRepository";
import { InventoryService } from "./InventoryService";
import { CalculationEngine } from "./CalculationEngine";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { CreditNoteInput } from "@/lib/validation/transactions";

export class CreditNoteService {
  static async list(
    user: SessionUser,
    options?: { customerId?: string; search?: string; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "credits.read");

    return CreditNoteRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "credits.read");

    const creditNote = await CreditNoteRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!creditNote) {
      throw new NotFoundError("Credit Note not found");
    }
    return creditNote;
  }

  static async create(user: SessionUser, input: CreditNoteInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "credits.create");

    const customer = await CustomerRepository.findByIdAndOrg(input.customerId, user.activeOrganizationId);
    if (!customer) {
      throw new NotFoundError("Customer not found in your organization");
    }

    const calculated = CalculationEngine.calculateDocument(input.lines);

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        return await db.$transaction(async (tx) => {
          const count = await tx.creditNote.count({ where: { organizationId: user.activeOrganizationId! } });
          const creditNoteNumber = `CN-${String(count + 1 + attempts).padStart(6, "0")}`;

          const existing = await tx.creditNote.findFirst({
            where: { creditNoteNumber, organizationId: user.activeOrganizationId! },
          });
          if (existing) {
            throw new Error("AUTO_NUMBER_COLLISION");
          }

          const creditNote = await tx.creditNote.create({
            data: {
              organizationId: user.activeOrganizationId!,
              creditNoteNumber,
              customerId: input.customerId,
              sourceInvoiceId: input.sourceInvoiceId || null,
              warehouseId: input.warehouseId || null,
              issueDate: new Date(input.issueDate),
              status: "DRAFT",
              subtotal: calculated.subtotal,
              taxTotal: calculated.taxTotal,
              total: calculated.total,
              returnToInventory: input.returnToInventory,
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
                  unitPrice: l.unitPrice,
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
              action: "credit_note.created",
              entityType: "CreditNote",
              entityId: creditNote.id,
              metadata: { creditNoteNumber, total: calculated.total },
            },
          });

          return creditNote;
        });
      } catch (err: any) {
        if (err.message === "AUTO_NUMBER_COLLISION") {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    throw new ConflictError("Failed to generate a unique credit note number. Please try again.");
  }

  static async issueCreditNote(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "credits.update");

    return db.$transaction(async (tx) => {
      // Row-level pessimistic lock on CreditNote to prevent double-issuing
      await tx.$queryRaw`SELECT id FROM "CreditNote" WHERE id = ${id} AND "organizationId" = ${user.activeOrganizationId!} FOR UPDATE`;

      const creditNote = await tx.creditNote.findFirst({
        where: { id, organizationId: user.activeOrganizationId! },
        include: { lines: true },
      });

      if (!creditNote) {
        throw new NotFoundError("Credit Note not found");
      }

      if (creditNote.status !== "DRAFT") {
        throw new ValidationError(`Only DRAFT credit notes can be issued. Current status is '${creditNote.status}'.`);
      }

      // Return items to inventory if returnToInventory = true and warehouse is set
      if (creditNote.returnToInventory && creditNote.warehouseId) {
        for (const line of creditNote.lines) {
          if (line.productId) {
            const product = await ProductRepository.findByIdAndOrg(line.productId, user.activeOrganizationId!);
            if (product && product.trackInventory) {
              await InventoryService.adjustStock(
                user,
                {
                  productId: line.productId,
                  warehouseId: creditNote.warehouseId,
                  adjustmentType: "CORRECTION",
                  quantityChange: Number(line.quantity), // Add stock back
                  reason: `Credit Note ${creditNote.creditNoteNumber} Issued (Return)`,
                },
                tx
              );
            }
          }
        }
      }

      const updated = await tx.creditNote.update({
        where: { id },
        data: { status: "ISSUED" },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "credit_note.issued",
          entityType: "CreditNote",
          entityId: id,
          metadata: { creditNoteNumber: creditNote.creditNoteNumber, total: Number(creditNote.total) },
        },
      });

      return updated;
    });
  }
}
