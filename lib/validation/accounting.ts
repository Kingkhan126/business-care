import { z } from "zod";

export const AccountTypeEnum = z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]);
export const NormalBalanceEnum = z.enum(["DEBIT", "CREDIT"]);
export const JournalSourceEnum = z.enum([
  "MANUAL",
  "SALES_INVOICE",
  "CUSTOMER_PAYMENT",
  "CREDIT_NOTE",
  "VENDOR_BILL",
  "VENDOR_PAYMENT",
  "VENDOR_CREDIT",
  "STOCK_ADJUSTMENT",
  "SYSTEM",
]);

export const MappingKeyEnum = z.enum([
  "ACCOUNTS_RECEIVABLE",
  "ACCOUNTS_PAYABLE",
  "SALES_REVENUE",
  "SALES_RETURNS",
  "TAX_PAYABLE",
  "TAX_RECOVERABLE",
  "INVENTORY_ASSET",
  "COST_OF_GOODS_SOLD",
  "CASH",
  "BANK",
  "OWNER_EQUITY",
  "RETAINED_EARNINGS",
  "DEFAULT_EXPENSE",
  "CUSTOMER_PAYMENT_CLEARING",
  "VENDOR_PAYMENT_CLEARING",
  "SALES_DISCOUNT",
  "PURCHASE_DISCOUNT",
]);

export const AccountSchema = z.object({
  code: z.string().min(1, "Account code is required").regex(/^[A-Za-z0-9\-_]+$/, "Invalid account code format").max(30).optional(),
  accountCode: z.string().min(1, "Account code is required").max(30).optional(),
  name: z.string().min(1, "Account name is required").max(100).optional(),
  accountName: z.string().min(1, "Account name is required").max(100).optional(),
  description: z.string().optional().nullable(),
  type: AccountTypeEnum.optional(),
  accountType: AccountTypeEnum.optional(),
  normalBalance: NormalBalanceEnum.optional(),
  parentId: z.string().optional().nullable(),
  allowPosting: z.boolean().optional().default(true),
  currency: z.string().min(3).max(3).optional().default("USD"),
}).transform((data) => {
  const code = data.accountCode || data.code || "";
  const name = data.accountName || data.name || "";
  const type = (data.accountType || data.type || "ASSET") as z.infer<typeof AccountTypeEnum>;
  return {
    ...data,
    code,
    accountCode: code,
    name,
    accountName: name,
    type,
    accountType: type,
    normalBalance: data.normalBalance || (type === "ASSET" || type === "EXPENSE" ? "DEBIT" : "CREDIT"),
  };
});

export type AccountInput = z.infer<typeof AccountSchema>;
export const createAccountSchema = AccountSchema;

export const updateAccountSchema = z.object({
  code: z.string().optional(),
  accountCode: z.string().optional(),
  name: z.string().optional(),
  accountName: z.string().optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
  allowPosting: z.boolean().optional(),
});

export const AccountMappingSchema = z.object({
  mappingKey: z.string().min(1, "Mapping key is required"),
  accountId: z.string().min(1, "Account ID is required"),
});

export type AccountMappingInput = z.input<typeof AccountMappingSchema>;
export const createAccountMappingSchema = AccountMappingSchema;

export const JournalLineSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  description: z.string().optional().nullable(),
  debit: z.number().min(0, "Debit cannot be negative").optional().default(0),
  credit: z.number().min(0, "Credit cannot be negative").optional().default(0),
  reference: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
}).refine(
  (data) => {
    const d = data.debit || 0;
    const c = data.credit || 0;
    if (d === 0 && c === 0) return false;
    return (d > 0 && c === 0) || (c > 0 && d === 0);
  },
  {
    message: "A journal line must have either debit > 0 or credit > 0, not both",
  }
);

export type JournalLineInput = z.input<typeof JournalLineSchema>;

export const createJournalSchema = z.object({
  entryDate: z.string().or(z.date()),
  memo: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  referenceType: z.string().optional().nullable(),
  referenceId: z.string().optional().nullable(),
  lines: z.array(JournalLineSchema).min(2, "Journal entry must contain at least 2 lines"),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    const diff = Math.abs(totalDebit - totalCredit);
    return diff < 0.001;
  },
  (data) => {
    const totalDebit = data.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    return {
      message: `Unbalanced journal entry: Total debits (${totalDebit}) must equal total credits (${totalCredit})`,
    };
  }
);

export const JournalEntrySchema = createJournalSchema;
export type JournalEntryInput = z.infer<typeof JournalEntrySchema>;
