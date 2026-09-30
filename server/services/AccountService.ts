import { db } from "@/db/client";
import { AccountRepository } from "../repositories/AccountRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { AccountInput } from "@/lib/validation/accounting";
import { AccountType, NormalBalance } from "@prisma/client";

export class AccountService {
  static async list(
    user: SessionUser,
    options?: { accountType?: AccountType; search?: string; isActive?: boolean; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.read");

    return AccountRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async getById(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.read");

    const account = await AccountRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!account) {
      throw new NotFoundError("Account not found");
    }
    return account;
  }

  static async create(user: SessionUser, input: AccountInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.manage");

    // Check account code uniqueness within org
    const existing = await AccountRepository.findByCodeAndOrg(input.accountCode, user.activeOrganizationId);
    if (existing) {
      throw new ConflictError(`Account code '${input.accountCode}' is already in use by '${existing.accountName}'.`);
    }

    // Determine level & validate parent
    let level = 1;
    if (input.parentId) {
      const parent = await AccountRepository.findByIdAndOrg(input.parentId, user.activeOrganizationId);
      if (!parent) {
        throw new NotFoundError("Parent account not found in your organization");
      }
      level = parent.level + 1;
      if (level > 10) {
        throw new ValidationError("Account hierarchy depth cannot exceed 10 levels.");
      }
    }

    // Default normal balance based on account type
    const defaultNormalBalance: Record<AccountType, NormalBalance> = {
      ASSET: "DEBIT",
      EXPENSE: "DEBIT",
      LIABILITY: "CREDIT",
      EQUITY: "CREDIT",
      REVENUE: "CREDIT",
    };

    const normalBalance = input.normalBalance || defaultNormalBalance[input.accountType];

    return db.account.create({
      data: {
        organizationId: user.activeOrganizationId,
        accountCode: input.accountCode,
        accountName: input.accountName,
        description: input.description,
        accountType: input.accountType,
        normalBalance,
        parentId: input.parentId || null,
        level,
        allowPosting: input.allowPosting ?? true,
        currency: input.currency || "USD",
      },
      include: { parent: true },
    });
  }

  static async update(user: SessionUser, id: string, input: Partial<AccountInput>) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.manage");

    const account = await AccountRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!account) {
      throw new NotFoundError("Account not found");
    }

    if (input.accountCode && input.accountCode !== account.accountCode) {
      const existing = await AccountRepository.findByCodeAndOrg(input.accountCode, user.activeOrganizationId);
      if (existing) {
        throw new ConflictError(`Account code '${input.accountCode}' is already in use.`);
      }
    }

    // Recursive parent check
    if (input.parentId && input.parentId !== account.parentId) {
      if (input.parentId === id) {
        throw new ValidationError("An account cannot be its own parent.");
      }

      // Check circular parent loop up to 50 levels
      let currentParentId: string | null = input.parentId;
      let depth = 0;
      while (currentParentId && depth < 50) {
        if (currentParentId === id) {
          throw new ValidationError("Circular parent account hierarchy detected.");
        }
        const p: { parentId: string | null } | null = await db.account.findUnique({ where: { id: currentParentId } });
        currentParentId = p?.parentId || null;
        depth++;
      }
    }

    return db.account.update({
      where: { id },
      data: {
        ...(input.accountCode && { accountCode: input.accountCode }),
        ...(input.accountName && { accountName: input.accountName }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        ...(input.allowPosting !== undefined && { allowPosting: input.allowPosting }),
      },
      include: { parent: true },
    });
  }

  static async deactivate(user: SessionUser, id: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.manage");

    const account = await AccountRepository.findByIdAndOrg(id, user.activeOrganizationId);
    if (!account) {
      throw new NotFoundError("Account not found");
    }

    if (account.isSystem) {
      throw new ValidationError(`System account '${account.accountName}' cannot be deactivated.`);
    }

    const postedLinesCount = await db.journalEntryLine.count({
      where: {
        accountId: id,
        journalEntry: { status: "POSTED" },
      },
    });

    if (postedLinesCount > 0) {
      throw new ValidationError(
        `Account '${account.accountCode} - ${account.accountName}' has ${postedLinesCount} posted journal entry lines and cannot be deactivated.`
      );
    }

    return db.account.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
