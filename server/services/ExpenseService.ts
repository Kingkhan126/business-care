import { db } from "@/db/client";
import { ExpenseRepository } from "../repositories/ExpenseRepository";
import { ExpenseCategoryRepository } from "../repositories/ExpenseCategoryRepository";
import { SupplierRepository } from "../repositories/SupplierRepository";
import { BankAccountRepository } from "../repositories/BankAccountRepository";
import { MembershipRepository } from "../repositories/MembershipRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { ExpenseAuditAction } from "@/lib/audit/expenseEvents";
import { CalculationEngine } from "./CalculationEngine";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { storageService, StorageFile } from "@/lib/storage";
import {
  CreateExpenseInput,
  UpdateExpenseInput,
  CreateExpenseSchema,
  UpdateExpenseSchema,
  ExpenseQueryInput,
  ExpenseQuerySchema,
} from "@/lib/validation/expense";
import { ExpenseType, ExpenseStatus, ExpensePaymentType } from "@prisma/client";

export class ExpenseService {
  static async listExpenses(user: SessionUser, rawQuery?: ExpenseQueryInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.read");

    const query = rawQuery ? ExpenseQuerySchema.parse(rawQuery) : undefined;
    const startDate = query?.startDate ? new Date(query.startDate) : undefined;
    const endDate = query?.endDate ? new Date(query.endDate) : undefined;

    return ExpenseRepository.listByOrg(user.activeOrganizationId, {
      ...query,
      startDate,
      endDate,
    });
  }

  static async getExpenseById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.read");

    const expense = await ExpenseRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!expense) {
      throw new NotFoundError("Expense not found");
    }
    return expense;
  }

  static async createExpense(user: SessionUser, rawInput: CreateExpenseInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.create");

    const input = CreateExpenseSchema.parse(rawInput);
    const orgId = user.activeOrganizationId;

    // 1. Validate Claimant for Employee Claim
    if (input.expenseType === ExpenseType.EMPLOYEE_CLAIM) {
      if (!input.claimantId) {
        throw new ValidationError("Claimant is required for employee expense claims.");
      }
      const member = await MembershipRepository.findByOrgAndUser(orgId, input.claimantId);
      if (!member || member.status !== "ACTIVE") {
        throw new ValidationError("Claimant must be an active member of this organization.");
      }
    }

    // 2. Validate Supplier if referenced
    if (input.supplierId) {
      const supplier = await SupplierRepository.findByIdAndOrg(input.supplierId, orgId);
      if (!supplier) {
        throw new NotFoundError("Supplier not found in your organization");
      }
      if (supplier.status !== "ACTIVE") {
        throw new ValidationError(`Supplier '${supplier.displayName}' is inactive.`);
      }
    }

    // 3. Validate Header Category if referenced
    if (input.categoryId) {
      const category = await ExpenseCategoryRepository.findByIdAndOrg(input.categoryId, orgId);
      if (!category) {
        throw new NotFoundError("Expense category not found in your organization");
      }
      if (!category.isActive) {
        throw new ValidationError(`Expense category '${category.name}' is inactive.`);
      }
    }

    // 4. Validate Bank Account if provided (required for immediate payment)
    if (input.bankAccountId) {
      const bankAccount = await BankAccountRepository.findByIdAndOrg(input.bankAccountId, orgId);
      if (!bankAccount) {
        throw new NotFoundError("Bank account not found in your organization");
      }
      if (!bankAccount.isActive) {
        throw new ValidationError(`Bank account '${bankAccount.accountName}' is inactive.`);
      }
    }

    // 5. Authoritative Server-side Monetary Calculations
    const calculatedLines: Array<{
      categoryId?: string | null;
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate: number;
      subtotal: number;
      taxAmount: number;
      total: number;
      notes?: string | null;
    }> = [];
    let subtotalAcc = 0;
    let taxTotalAcc = 0;

    for (const line of input.lines) {
      // Validate line category if provided
      if (line.categoryId) {
        const lineCategory = await ExpenseCategoryRepository.findByIdAndOrg(line.categoryId, orgId);
        if (!lineCategory) {
          throw new NotFoundError(`Category ID '${line.categoryId}' not found in your organization.`);
        }
        if (!lineCategory.isActive) {
          throw new ValidationError(`Category '${lineCategory.name}' is inactive.`);
        }
      }

      const calculated = CalculationEngine.calculateLine({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        description: line.description,
      });

      subtotalAcc += calculated.subtotal;
      taxTotalAcc += calculated.taxAmount;

      calculatedLines.push({
        categoryId: line.categoryId || input.categoryId || null,
        description: line.description,
        quantity: calculated.quantity,
        unitPrice: calculated.unitPrice,
        taxRate: calculated.taxRate,
        subtotal: calculated.subtotal,
        taxAmount: calculated.taxAmount,
        total: calculated.total,
        notes: line.notes || null,
      });
    }

    const subtotal = CalculationEngine.roundMoney(subtotalAcc);
    const taxTotal = CalculationEngine.roundMoney(taxTotalAcc);
    const total = CalculationEngine.roundMoney(subtotal + taxTotal);
    const expenseDate = new Date(input.expenseDate);
    const dueDate = input.dueDate ? new Date(input.dueDate) : null;

    // 6. Concurrency-Safe Document Numbering & Creation
    let attempts = 0;
    const maxAttempts = 5;
    const year = expenseDate.getFullYear();

    while (attempts < maxAttempts) {
      try {
        return await db.$transaction(async (tx) => {
          const count = await tx.expense.count({
            where: {
              organizationId: orgId,
              expenseDate: {
                gte: new Date(`${year}-01-01`),
                lte: new Date(`${year}-12-31T23:59:59.999Z`),
              },
            },
          });

          const sequence = String(count + 1 + attempts).padStart(5, "0");
          const expenseNumber = `EXP-${year}-${sequence}`;

          const existing = await tx.expense.findFirst({
            where: { organizationId: orgId, expenseNumber },
          });
          if (existing) {
            throw new Error("AUTO_NUMBER_COLLISION");
          }

          const created = await tx.expense.create({
            data: {
              organization: { connect: { id: orgId } },
              expenseNumber,
              expenseType: input.expenseType,
              status: ExpenseStatus.DRAFT,
              paymentType: input.paymentType,
              expenseDate,
              dueDate,
              description: input.description,
              notes: input.notes || null,
              currency: input.currency || "USD",
              subtotal,
              taxTotal,
              total,
              ...(input.claimantId && { claimant: { connect: { id: input.claimantId } } }),
              ...(input.supplierId && { supplier: { connect: { id: input.supplierId } } }),
              ...(input.categoryId && { category: { connect: { id: input.categoryId } } }),
              ...(input.bankAccountId && { bankAccount: { connect: { id: input.bankAccountId } } }),
              createdBy: { connect: { id: user.id } },
              lines: {
                create: calculatedLines.map((l) => ({
                  description: l.description,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  taxRate: l.taxRate,
                  subtotal: l.subtotal,
                  taxAmount: l.taxAmount,
                  total: l.total,
                  notes: l.notes,
                  ...(l.categoryId && { category: { connect: { id: l.categoryId } } }),
                })),
              },
            },
            include: {
              lines: { include: { category: true } },
              category: true,
              supplier: true,
              claimant: true,
              bankAccount: true,
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId: orgId,
              actorId: user.id,
              action: ExpenseAuditAction.EXPENSE_CREATED,
              entityType: "Expense",
              entityId: created.id,
              metadata: {
                expenseNumber: created.expenseNumber,
                expenseType: created.expenseType,
                total: Number(created.total),
              },
            },
          });

          return created;
        });
      } catch (err: any) {
        if (err.code === "P2002" || err.message?.includes("COLLISION")) {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    throw new ConflictError("Failed to allocate a unique expense number after multiple attempts. Please retry.");
  }

  static async updateExpense(user: SessionUser, id: string, rawInput: UpdateExpenseInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.update");

    const input = UpdateExpenseSchema.parse(rawInput);
    const orgId = user.activeOrganizationId;

    return db.$transaction(async (tx) => {
      // Row lock to guard against race conditions
      if (typeof (tx as any).$queryRaw === "function") {
        await (tx as any).$queryRaw`SELECT id FROM "Expense" WHERE id = ${id} FOR UPDATE`.catch(() => {});
      }

      const existing = await tx.expense.findFirst({
        where: { id, organizationId: orgId },
        include: { lines: true },
      });

      if (!existing) {
        throw new NotFoundError("Expense not found");
      }

      if (existing.status !== ExpenseStatus.DRAFT) {
        throw new ValidationError(`Cannot modify expense with status '${existing.status}'. Only DRAFT expenses can be updated.`);
      }

      // If lines updated, recalculate totals
      let subtotal = Number(existing.subtotal);
      let taxTotal = Number(existing.taxTotal);
      let total = Number(existing.total);
      let updatedLines = undefined;

      if (input.lines && input.lines.length > 0) {
        await tx.expenseLine.deleteMany({ where: { expenseId: id } });

        let subtotalAcc = 0;
        let taxTotalAcc = 0;
        const newLines = [];

        for (const line of input.lines) {
          const calculated = CalculationEngine.calculateLine({
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            description: line.description,
          });

          subtotalAcc += calculated.subtotal;
          taxTotalAcc += calculated.taxAmount;

          newLines.push({
            expenseId: id,
            categoryId: line.categoryId || input.categoryId || existing.categoryId || null,
            description: line.description,
            quantity: calculated.quantity,
            unitPrice: calculated.unitPrice,
            taxRate: calculated.taxRate,
            subtotal: calculated.subtotal,
            taxAmount: calculated.taxAmount,
            total: calculated.total,
            notes: line.notes || null,
          });
        }

        subtotal = CalculationEngine.roundMoney(subtotalAcc);
        taxTotal = CalculationEngine.roundMoney(taxTotalAcc);
        total = CalculationEngine.roundMoney(subtotal + taxTotal);

        await tx.expenseLine.createMany({ data: newLines });
      }

      const updated = await tx.expense.update({
        where: { id },
        data: {
          ...(input.expenseDate && { expenseDate: new Date(input.expenseDate) }),
          ...(input.dueDate !== undefined && { dueDate: input.dueDate ? new Date(input.dueDate) : null }),
          ...(input.description && { description: input.description }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.currency && { currency: input.currency }),
          ...(input.supplierId !== undefined && {
            supplier: input.supplierId ? { connect: { id: input.supplierId } } : { disconnect: true },
          }),
          ...(input.categoryId !== undefined && {
            category: input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true },
          }),
          ...(input.bankAccountId !== undefined && {
            bankAccount: input.bankAccountId ? { connect: { id: input.bankAccountId } } : { disconnect: true },
          }),
          subtotal,
          taxTotal,
          total,
        },
        include: {
          lines: { include: { category: true } },
          category: true,
          supplier: true,
          claimant: true,
          bankAccount: true,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          actorId: user.id,
          action: ExpenseAuditAction.EXPENSE_UPDATED,
          entityType: "Expense",
          entityId: updated.id,
          metadata: {
            expenseNumber: updated.expenseNumber,
            total: Number(updated.total),
          },
        },
      });

      return updated;
    });
  }

  static async submitExpense(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.submit");

    const orgId = user.activeOrganizationId;

    return db.$transaction(async (tx) => {
      if (typeof (tx as any).$queryRaw === "function") {
        await (tx as any).$queryRaw`SELECT id FROM "Expense" WHERE id = ${id} FOR UPDATE`.catch(() => {});
      }

      const expense = await tx.expense.findFirst({
        where: { id, organizationId: orgId },
        include: { lines: true },
      });

      if (!expense) {
        throw new NotFoundError("Expense not found");
      }

      if (expense.status !== ExpenseStatus.DRAFT && expense.status !== ExpenseStatus.REJECTED) {
        throw new ValidationError(`Cannot submit expense with status '${expense.status}'. Expected DRAFT or REJECTED.`);
      }

      if (!expense.lines || expense.lines.length === 0) {
        throw new ValidationError("Cannot submit an expense without line items.");
      }

      const updated = await tx.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.SUBMITTED,
          rejectionReason: null,
        },
        include: { lines: true, category: true, claimant: true },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          actorId: user.id,
          action: ExpenseAuditAction.EXPENSE_SUBMITTED,
          entityType: "Expense",
          entityId: updated.id,
          metadata: { expenseNumber: updated.expenseNumber },
        },
      });

      return updated;
    });
  }

  static async cancelExpense(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);

    const orgId = user.activeOrganizationId;

    return db.$transaction(async (tx) => {
      if (typeof (tx as any).$queryRaw === "function") {
        await (tx as any).$queryRaw`SELECT id FROM "Expense" WHERE id = ${id} FOR UPDATE`.catch(() => {});
      }

      const expense = await tx.expense.findFirst({
        where: { id, organizationId: orgId },
      });

      if (!expense) {
        throw new NotFoundError("Expense not found");
      }

      if (!([ExpenseStatus.DRAFT, ExpenseStatus.SUBMITTED, ExpenseStatus.REJECTED] as ExpenseStatus[]).includes(expense.status)) {
        throw new ValidationError(`Cannot cancel expense with status '${expense.status}'. Only unposted expenses can be cancelled.`);
      }

      return tx.expense.update({
        where: { id },
        data: { status: ExpenseStatus.CANCELLED },
      });
    });
  }

  /**
   * Retrieves all attachments for an expense.
   */
  static async listAttachments(user: SessionUser, expenseId: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.attachments");

    const expense = await ExpenseRepository.findByIdAndOrg(expenseId, user.activeOrganizationId);
    if (!expense) {
      throw new NotFoundError("Expense not found");
    }

    return ExpenseRepository.findAttachments(expenseId, user.activeOrganizationId);
  }

  /**
   * Attaches a document or receipt image to an expense with strict security validation.
   */
  static async addAttachment(user: SessionUser, expenseId: string, file: StorageFile) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.attachments");

    const orgId = user.activeOrganizationId;
    const expense = await ExpenseRepository.findByIdAndOrg(expenseId, orgId);
    if (!expense) {
      throw new NotFoundError("Expense not found");
    }

    if (expense.status === ExpenseStatus.VOIDED || expense.status === ExpenseStatus.CANCELLED) {
      throw new ValidationError(`Cannot add attachments to a ${expense.status} expense.`);
    }

    const { storagePath, hash } = await storageService.uploadExpenseAttachment(orgId, expenseId, file);

    const attachment = await db.expenseAttachment.create({
      data: {
        organizationId: orgId,
        expenseId,
        fileName: file.filename,
        fileSize: file.sizeBytes,
        mimeType: file.mimeType,
        storagePath,
        hash,
        uploadedById: user.id,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await db.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: user.id,
        action: ExpenseAuditAction.EXPENSE_ATTACHMENT_ADDED,
        entityType: "ExpenseAttachment",
        entityId: attachment.id,
        metadata: {
          expenseId,
          expenseNumber: expense.expenseNumber,
          fileName: file.filename,
          fileSize: file.sizeBytes,
        },
      },
    });

    return attachment;
  }

  /**
   * Removes an attachment from an expense.
   */
  static async deleteAttachment(user: SessionUser, expenseId: string, attachmentId: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.attachments");

    const orgId = user.activeOrganizationId;
    const expense = await ExpenseRepository.findByIdAndOrg(expenseId, orgId);
    if (!expense) {
      throw new NotFoundError("Expense not found");
    }

    const attachment = await db.expenseAttachment.findFirst({
      where: { id: attachmentId, expenseId, organizationId: orgId },
    });
    if (!attachment) {
      throw new NotFoundError("Attachment not found");
    }

    await storageService.deleteExpenseAttachment(orgId, expenseId, attachment.storagePath);

    await db.expenseAttachment.delete({
      where: { id: attachment.id },
    });

    await db.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: user.id,
        action: ExpenseAuditAction.EXPENSE_ATTACHMENT_REMOVED,
        entityType: "ExpenseAttachment",
        entityId: attachment.id,
        metadata: {
          expenseId,
          expenseNumber: expense.expenseNumber,
          fileName: attachment.fileName,
        },
      },
    });

    return { success: true };
  }

  /**
   * Generates authoritative server-side expense aggregates and summaries.
   */
  static async getExpenseReports(
    user: SessionUser,
    filters?: {
      startDate?: string;
      endDate?: string;
      categoryId?: string;
      status?: ExpenseStatus;
      expenseType?: ExpenseType;
      claimantId?: string;
    }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.reports");

    const orgId = user.activeOrganizationId;

    const where: any = {
      organizationId: orgId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.expenseType && { expenseType: filters.expenseType }),
      ...(filters?.categoryId && { categoryId: filters.categoryId }),
      ...(filters?.claimantId && { claimantId: filters.claimantId }),
      ...((filters?.startDate || filters?.endDate) && {
        expenseDate: {
          ...(filters?.startDate && { gte: new Date(filters.startDate) }),
          ...(filters?.endDate && { lte: new Date(filters.endDate) }),
        },
      }),
    };

    const [totalAggregate, byStatus, byType, byCategory, recentExpenses] = await Promise.all([
      // Overall authoritative aggregate
      db.expense.aggregate({
        where,
        _count: { id: true },
        _sum: { subtotal: true, taxTotal: true, total: true },
      }),

      // Grouped by Status
      db.expense.groupBy({
        by: ["status"],
        where,
        _count: { id: true },
        _sum: { total: true },
      }),

      // Grouped by Expense Type
      db.expense.groupBy({
        by: ["expenseType"],
        where,
        _count: { id: true },
        _sum: { total: true },
      }),

      // Grouped by Category
      db.expense.groupBy({
        by: ["categoryId"],
        where,
        _count: { id: true },
        _sum: { total: true },
      }),

      // Recent representative items
      db.expense.findMany({
        where,
        take: 10,
        orderBy: { expenseDate: "desc" },
        include: {
          category: { select: { id: true, name: true, code: true } },
          claimant: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    // Hydrate category details
    const categoryIds = byCategory.map((c) => c.categoryId).filter(Boolean) as string[];
    const categories = await db.expenseCategory.findMany({
      where: { id: { in: categoryIds }, organizationId: orgId },
      select: { id: true, name: true, code: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const categoryBreakdown = byCategory.map((item) => {
      const cat = item.categoryId ? categoryMap.get(item.categoryId) : null;
      return {
        categoryId: item.categoryId,
        categoryName: cat?.name || "Uncategorized",
        categoryCode: cat?.code || "N/A",
        count: item._count.id,
        total: Number(item._sum.total || 0),
      };
    });

    const statusBreakdown = byStatus.map((item) => ({
      status: item.status,
      count: item._count.id,
      total: Number(item._sum.total || 0),
    }));

    const typeBreakdown = byType.map((item) => ({
      expenseType: item.expenseType,
      count: item._count.id,
      total: Number(item._sum.total || 0),
    }));

    return {
      summary: {
        count: totalAggregate._count.id,
        subtotal: Number(totalAggregate._sum.subtotal || 0),
        taxTotal: Number(totalAggregate._sum.taxTotal || 0),
        total: Number(totalAggregate._sum.total || 0),
      },
      statusBreakdown,
      typeBreakdown,
      categoryBreakdown,
      recentExpenses,
    };
  }
}
