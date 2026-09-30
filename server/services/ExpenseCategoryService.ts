import { ExpenseCategoryRepository } from "../repositories/ExpenseCategoryRepository";
import { AccountRepository } from "../repositories/AccountRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { ExpenseAuditAction } from "@/lib/audit/expenseEvents";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import {
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
  CreateExpenseCategorySchema,
  UpdateExpenseCategorySchema,
} from "@/lib/validation/expense";

export class ExpenseCategoryService {
  static async listCategories(
    user: SessionUser,
    options?: { isActive?: boolean; search?: string; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.read");

    return ExpenseCategoryRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getCategoryById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.read");

    const category = await ExpenseCategoryRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!category) {
      throw new NotFoundError("Expense category not found");
    }
    return category;
  }

  static async createCategory(user: SessionUser, rawInput: CreateExpenseCategoryInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.manage");

    const input = CreateExpenseCategorySchema.parse(rawInput);

    // Uniqueness checks within organization
    const [existingCode, existingName] = await Promise.all([
      ExpenseCategoryRepository.findByCodeAndOrg(input.code, user.activeOrganizationId),
      ExpenseCategoryRepository.findByNameAndOrg(input.name, user.activeOrganizationId),
    ]);

    if (existingCode) {
      throw new ConflictError(`Expense category code '${input.code}' is already in use.`);
    }
    if (existingName) {
      throw new ConflictError(`Expense category name '${input.name}' is already in use.`);
    }

    // Validate linked ledger account if provided
    if (input.linkedExpenseAccountId) {
      const account = await AccountRepository.findByIdAndOrg(
        input.linkedExpenseAccountId,
        user.activeOrganizationId
      );
      if (!account) {
        throw new NotFoundError("Linked expense account not found in your organization");
      }
      if (!account.isActive) {
        throw new ValidationError(`Account '${account.accountCode} - ${account.accountName}' is inactive.`);
      }
      if (account.accountType !== "EXPENSE") {
        throw new ValidationError(`Linked account must be of type EXPENSE (received ${account.accountType}).`);
      }
    }

    const created = await ExpenseCategoryRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      name: input.name,
      code: input.code,
      description: input.description || null,
      taxRate: input.taxRate ?? 0.0,
      isActive: input.isActive ?? true,
      ...(input.linkedExpenseAccountId && {
        linkedExpenseAccount: { connect: { id: input.linkedExpenseAccountId } },
      }),
    });

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: ExpenseAuditAction.EXPENSE_CATEGORY_CREATED,
      entityType: "ExpenseCategory",
      entityId: created.id,
      metadata: {
        code: created.code,
        name: created.name,
        linkedExpenseAccountId: input.linkedExpenseAccountId || null,
      },
    });

    return created;
  }

  static async updateCategory(user: SessionUser, id: string, rawInput: UpdateExpenseCategoryInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.manage");

    const input = UpdateExpenseCategorySchema.parse(rawInput);

    const category = await ExpenseCategoryRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!category) {
      throw new NotFoundError("Expense category not found");
    }

    if (input.name && input.name !== category.name) {
      const existingName = await ExpenseCategoryRepository.findByNameAndOrg(input.name, user.activeOrganizationId);
      if (existingName) {
        throw new ConflictError(`Expense category name '${input.name}' is already in use.`);
      }
    }

    if (input.linkedExpenseAccountId) {
      const account = await AccountRepository.findByIdAndOrg(
        input.linkedExpenseAccountId,
        user.activeOrganizationId
      );
      if (!account) {
        throw new NotFoundError("Linked expense account not found in your organization");
      }
      if (!account.isActive) {
        throw new ValidationError(`Account '${account.accountCode} - ${account.accountName}' is inactive.`);
      }
      if (account.accountType !== "EXPENSE") {
        throw new ValidationError(`Linked account must be of type EXPENSE (received ${account.accountType}).`);
      }
    }

    const updated = await ExpenseCategoryRepository.update(id, user.activeOrganizationId, {
      ...(input.name && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.taxRate !== undefined && { taxRate: input.taxRate }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.linkedExpenseAccountId !== undefined && {
        linkedExpenseAccount: input.linkedExpenseAccountId
          ? { connect: { id: input.linkedExpenseAccountId } }
          : { disconnect: true },
      }),
    });

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: ExpenseAuditAction.EXPENSE_CATEGORY_UPDATED,
      entityType: "ExpenseCategory",
      entityId: updated.id,
      metadata: {
        before: { name: category.name, taxRate: category.taxRate, isActive: category.isActive },
        after: { name: updated.name, taxRate: updated.taxRate, isActive: updated.isActive },
      },
    });

    return updated;
  }

  static async deactivateCategory(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "expense.manage");

    const category = await ExpenseCategoryRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!category) {
      throw new NotFoundError("Expense category not found");
    }

    const deactivated = await ExpenseCategoryRepository.deactivate(id, user.activeOrganizationId);

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: ExpenseAuditAction.EXPENSE_CATEGORY_DEACTIVATED,
      entityType: "ExpenseCategory",
      entityId: deactivated.id,
      metadata: { code: deactivated.code, name: deactivated.name },
    });

    return deactivated;
  }
}
