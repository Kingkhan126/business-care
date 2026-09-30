import { db } from "@/db/client";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { MappingKey } from "@prisma/client";

export class AccountMappingService {
  static async listMappings(user: SessionUser) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.read");

    return db.accountMapping.findMany({
      where: { organizationId: user.activeOrganizationId },
      include: { account: true },
    });
  }

  static async setMapping(user: SessionUser, mappingKey: MappingKey, accountId: string) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.manage");

    const account = await db.account.findFirst({
      where: { id: accountId, organizationId: user.activeOrganizationId },
    });

    if (!account) {
      throw new NotFoundError("Account not found in your organization");
    }

    if (!account.isActive) {
      throw new ValidationError(`Account '${account.accountCode} - ${account.accountName}' is inactive.`);
    }

    if (!account.allowPosting) {
      throw new ValidationError(`Account '${account.accountCode} - ${account.accountName}' does not allow direct posting.`);
    }

    return db.accountMapping.upsert({
      where: {
        organizationId_mappingKey: {
          organizationId: user.activeOrganizationId,
          mappingKey,
        },
      },
      update: { accountId },
      create: {
        organizationId: user.activeOrganizationId,
        mappingKey,
        accountId,
      },
      include: { account: true },
    });
  }

  static async resolveAccount(organizationId: string, mappingKey: MappingKey) {
    const mapping = await db.accountMapping.findUnique({
      where: {
        organizationId_mappingKey: {
          organizationId,
          mappingKey,
        },
      },
      include: { account: true },
    });

    if (mapping && mapping.account && mapping.account.isActive) {
      return mapping.account;
    }

    // Fallback search by default code convention if mapping record not set
    const codeFallbacks: Record<MappingKey, string> = {
      ACCOUNTS_RECEIVABLE: "1200",
      ACCOUNTS_PAYABLE: "2100",
      SALES_REVENUE: "4100",
      SALES_RETURNS: "4300",
      TAX_PAYABLE: "2200",
      TAX_RECOVERABLE: "2210",
      INVENTORY_ASSET: "1300",
      COST_OF_GOODS_SOLD: "5100",
      CASH: "1100",
      BANK: "1110",
      OWNER_EQUITY: "3100",
      RETAINED_EARNINGS: "3200",
      DEFAULT_EXPENSE: "6400",
      EMPLOYEE_REIMBURSEMENTS_PAYABLE: "2150",
    };

    const fallbackCode = codeFallbacks[mappingKey];
    const fallbackAccount = await db.account.findFirst({
      where: { organizationId, accountCode: fallbackCode, isActive: true },
    });

    if (fallbackAccount) {
      return fallbackAccount;
    }

    throw new ValidationError(
      `Account mapping for '${mappingKey}' is not configured for your organization. Please update Accounting Settings.`
    );
  }
}
