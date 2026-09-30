import { db } from "@/db/client";
import { PrismaClient, Prisma, AccountType, NormalBalance, MappingKey } from "@prisma/client";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export interface DefaultCategoryDefinition {
  code: string;
  name: string;
  description: string;
  accountCode: string;
  taxRate: number;
}

export class ExpenseMasterDataService {
  /**
   * Default Chart of Accounts specifications required for Phase 7 Expense Management.
   */
  public static readonly DEFAULT_ACCOUNTS = [
    {
      accountCode: "2150",
      accountName: "Employee Reimbursements Payable",
      description: "Short-term liability for approved employee out-of-pocket expenses awaiting reimbursement",
      accountType: "LIABILITY" as AccountType,
      normalBalance: "CREDIT" as NormalBalance,
    },
    {
      accountCode: "6100",
      accountName: "Advertising & Marketing",
      description: "Direct advertising, digital marketing, and promotional campaigns",
      accountType: "EXPENSE" as AccountType,
      normalBalance: "DEBIT" as NormalBalance,
    },
    {
      accountCode: "6200",
      accountName: "Travel & Lodging",
      description: "Business flights, ground transit, hotels, and travel allowances",
      accountType: "EXPENSE" as AccountType,
      normalBalance: "DEBIT" as NormalBalance,
    },
    {
      accountCode: "6300",
      accountName: "Meals & Entertainment",
      description: "Client business meals, refreshments, and employee dining",
      accountType: "EXPENSE" as AccountType,
      normalBalance: "DEBIT" as NormalBalance,
    },
    {
      accountCode: "6400",
      accountName: "General & Administrative Expense",
      description: "General overhead, operating fees, and administrative expenses",
      accountType: "EXPENSE" as AccountType,
      normalBalance: "DEBIT" as NormalBalance,
    },
    {
      accountCode: "6500",
      accountName: "Office Supplies & Software",
      description: "Stationery, office equipment, cloud software, and SaaS subscriptions",
      accountType: "EXPENSE" as AccountType,
      normalBalance: "DEBIT" as NormalBalance,
    },
    {
      accountCode: "6600",
      accountName: "Utilities & Telecommunications",
      description: "Office internet, telephony, electricity, and facility services",
      accountType: "EXPENSE" as AccountType,
      normalBalance: "DEBIT" as NormalBalance,
    },
  ];

  /**
   * Default operational expense categories.
   */
  public static readonly DEFAULT_CATEGORIES: DefaultCategoryDefinition[] = [
    {
      code: "OFFICE-SUPP",
      name: "Office Supplies",
      description: "Stationery, consumables, printing, and minor office equipment",
      accountCode: "6500",
      taxRate: 0.0,
    },
    {
      code: "TRAVEL",
      name: "Travel & Lodging",
      description: "Airlines, railways, hotels, car rentals, and toll charges",
      accountCode: "6200",
      taxRate: 0.0,
    },
    {
      code: "MEALS",
      name: "Meals & Entertainment",
      description: "Business dining, client lunches, and team refreshments",
      accountCode: "6300",
      taxRate: 0.0,
    },
    {
      code: "SOFTWARE",
      name: "Software & Subscriptions",
      description: "SaaS subscriptions, developer tooling, and cloud infrastructure",
      accountCode: "6500",
      taxRate: 0.0,
    },
    {
      code: "UTILITIES",
      name: "Utilities & Telecommunications",
      description: "Internet connectivity, mobile phone plans, and power utilities",
      accountCode: "6600",
      taxRate: 0.0,
    },
    {
      code: "MARKETING",
      name: "Advertising & Marketing",
      description: "Online ads, sponsorship, branding assets, and print media",
      accountCode: "6100",
      taxRate: 0.0,
    },
    {
      code: "GEN-ADMIN",
      name: "General & Administrative",
      description: "Miscellaneous business operational and overhead expenses",
      accountCode: "6400",
      taxRate: 0.0,
    },
  ];

  /**
   * Idempotently provisions Phase 7 Chart of Accounts, Liability Account Mapping,
   * and Default Expense Categories for a specific organization.
   *
   * Preserves customized existing mappings and categories.
   */
  public static async provisionOrganizationDefaults(
    clientOrDb: DatabaseClient = db as any,
    organizationId: string
  ): Promise<{
    accountsCreated: number;
    mappingCreated: boolean;
    categoriesCreated: number;
  }> {
    const client = clientOrDb as any;
    let accountsCreated = 0;
    let categoriesCreated = 0;

    // 1. Ensure required Chart of Accounts entries exist
    const accountIdByCode = new Map<string, string>();
    for (const accDef of this.DEFAULT_ACCOUNTS) {
      let account = await client.account.findUnique({
        where: {
          organizationId_accountCode: {
            organizationId,
            accountCode: accDef.accountCode,
          },
        },
      });

      if (!account) {
        account = await client.account.create({
          data: {
            organizationId,
            accountCode: accDef.accountCode,
            accountName: accDef.accountName,
            description: accDef.description,
            accountType: accDef.accountType,
            normalBalance: accDef.normalBalance,
            level: 1,
            isSystem: false,
            isActive: true,
            allowPosting: true,
            currency: "USD",
          },
        });
        accountsCreated++;
      }

      accountIdByCode.set(accDef.accountCode, account.id);
    }

    // 2. Ensure EMPLOYEE_REIMBURSEMENTS_PAYABLE mapping exists
    // PRESERVATION RULE: Check if mapping is already configured. Do NOT overwrite.
    let mappingCreated = false;
    const existingMapping = await client.accountMapping.findUnique({
      where: {
        organizationId_mappingKey: {
          organizationId,
          mappingKey: "EMPLOYEE_REIMBURSEMENTS_PAYABLE" as MappingKey,
        },
      },
    });

    if (!existingMapping) {
      const payableAccountId = accountIdByCode.get("2150");
      if (payableAccountId) {
        await client.accountMapping.create({
          data: {
            organizationId,
            mappingKey: "EMPLOYEE_REIMBURSEMENTS_PAYABLE" as MappingKey,
            accountId: payableAccountId,
          },
        });
        mappingCreated = true;
      }
    }

    // 3. Ensure Default Expense Categories exist
    // PRESERVATION RULE: If category already exists by code, do NOT overwrite customizations.
    for (const catDef of this.DEFAULT_CATEGORIES) {
      const existingCategory = await client.expenseCategory.findUnique({
        where: {
          organizationId_code: {
            organizationId,
            code: catDef.code,
          },
        },
      });

      if (!existingCategory) {
        const linkedAccountId = accountIdByCode.get(catDef.accountCode) || null;
        await client.expenseCategory.create({
          data: {
            organizationId,
            code: catDef.code,
            name: catDef.name,
            description: catDef.description,
            linkedExpenseAccountId: linkedAccountId,
            taxRate: catDef.taxRate,
            isActive: true,
          },
        });
        categoriesCreated++;
      }
    }

    return {
      accountsCreated,
      mappingCreated,
      categoriesCreated,
    };
  }
}
