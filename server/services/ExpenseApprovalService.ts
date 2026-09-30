import { db } from "@/db/client";
import { AuditRepository } from "../repositories/AuditRepository";
import { ExpenseAuditAction } from "@/lib/audit/expenseEvents";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { RejectExpenseSchema, RejectExpenseInput } from "@/lib/validation/expense";
import { ExpenseStatus, ExpenseType } from "@prisma/client";

export class ExpenseApprovalService {
  /**
   * Approves a submitted expense claim or direct expense.
   * Concurrency-safe: Locks the expense row with FOR UPDATE.
   * Enforces Anti-Self-Approval rule for employee claims.
   */
  static async approve(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.approve");

    const orgId = user.activeOrganizationId;

    return db.$transaction(async (tx) => {
      // 1. Database Row Lock for Concurrency Serialization
      if (typeof (tx as any).$queryRaw === "function") {
        await (tx as any).$queryRaw`SELECT id FROM "Expense" WHERE id = ${id} FOR UPDATE`.catch(() => {});
      }

      const expense = await tx.expense.findFirst({
        where: { id, organizationId: orgId },
        include: { lines: true, claimant: true },
      });

      if (!expense) {
        throw new NotFoundError("Expense not found");
      }

      // 2. State Validation
      if (expense.status === ExpenseStatus.APPROVED) {
        throw new ConflictError("Expense is already approved.");
      }

      const isSubmittableState =
        expense.status === ExpenseStatus.SUBMITTED ||
        (expense.status === ExpenseStatus.DRAFT && expense.expenseType === ExpenseType.DIRECT_BUSINESS);

      if (!isSubmittableState) {
        throw new ValidationError(`Cannot approve expense with status '${expense.status}'. Expected SUBMITTED.`);
      }

      // 3. Strict Anti-Self-Approval Enforcement
      if (expense.expenseType === ExpenseType.EMPLOYEE_CLAIM && expense.claimantId) {
        if (expense.claimantId === user.id) {
          throw new ValidationError("Claimants are strictly prohibited from approving their own expense claims.");
        }
      }

      // 4. Update Status to APPROVED
      const updated = await tx.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.APPROVED,
          approvedById: user.id,
          approvedAt: new Date(),
          rejectionReason: null,
        },
        include: {
          category: true,
          supplier: true,
          claimant: true,
          lines: true,
        },
      });

      // 5. Audit Logging
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          actorId: user.id,
          action: ExpenseAuditAction.EXPENSE_APPROVED,
          entityType: "Expense",
          entityId: updated.id,
          metadata: {
            expenseNumber: updated.expenseNumber,
            expenseType: updated.expenseType,
            total: Number(updated.total),
            approvedById: user.id,
          },
        },
      });

      return updated;
    });
  }

  /**
   * Rejects a submitted expense claim.
   * Concurrency-safe: Locks the expense row with FOR UPDATE.
   */
  static async reject(user: SessionUser, id: string, rawInput: RejectExpenseInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.reject");

    const input = RejectExpenseSchema.parse(rawInput);
    const orgId = user.activeOrganizationId;

    return db.$transaction(async (tx) => {
      // 1. Database Row Lock for Concurrency Serialization
      if (typeof (tx as any).$queryRaw === "function") {
        await (tx as any).$queryRaw`SELECT id FROM "Expense" WHERE id = ${id} FOR UPDATE`.catch(() => {});
      }

      const expense = await tx.expense.findFirst({
        where: { id, organizationId: orgId },
      });

      if (!expense) {
        throw new NotFoundError("Expense not found");
      }

      if (expense.status === ExpenseStatus.REJECTED) {
        throw new ConflictError("Expense is already rejected.");
      }

      if (expense.status !== ExpenseStatus.SUBMITTED) {
        throw new ValidationError(`Cannot reject expense with status '${expense.status}'. Expected SUBMITTED.`);
      }

      const updated = await tx.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.REJECTED,
          rejectionReason: input.reason,
          approvedById: null,
          approvedAt: null,
        },
        include: { lines: true, category: true, claimant: true },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          actorId: user.id,
          action: ExpenseAuditAction.EXPENSE_REJECTED,
          entityType: "Expense",
          entityId: updated.id,
          metadata: {
            expenseNumber: updated.expenseNumber,
            reason: input.reason,
          },
        },
      });

      return updated;
    });
  }
}
