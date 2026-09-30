import { z } from "zod";

export const BankAccountTypeEnum = z.enum([
  "CHECKING",
  "SAVINGS",
  "CASH",
  "CREDIT_CARD",
  "MONEY_MARKET",
  "OTHER",
]);

export const BankTransactionTypeEnum = z.enum([
  "DEPOSIT",
  "WITHDRAWAL",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "FEE",
  "INTEREST",
  "ADJUSTMENT",
  "OTHER",
]);

export const BankTransactionStatusEnum = z.enum([
  "UNMATCHED",
  "MATCHED",
  "RECONCILED",
  "VOIDED",
]);

export const BankTransactionSourceEnum = z.enum([
  "MANUAL",
  "IMPORT",
  "FEED",
]);

export const BankTransferStatusEnum = z.enum([
  "PENDING",
  "COMPLETED",
  "CANCELLED",
]);

export const ReconciliationStatusEnum = z.enum([
  "OPEN",
  "COMPLETED",
  "VOIDED",
]);

export const ImportBatchStatusEnum = z.enum([
  "PENDING",
  "COMPLETED",
  "FAILED",
]);

// Bank Account Validation
export const CreateBankAccountSchema = z.object({
  accountName: z.string().min(1, "Account name is required").max(100),
  accountType: BankAccountTypeEnum.default("CHECKING"),
  accountNumberMasked: z.string().max(30).optional().nullable(),
  routingNumber: z.string().max(30).optional().nullable(),
  institutionName: z.string().max(100).optional().nullable(),
  currency: z.string().min(3).max(3).default("USD"),
  openingBalance: z.number().default(0),
  openingBalanceDate: z.string().or(z.date()).optional().nullable(),
  linkedLedgerAccountId: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  createOpeningBalanceJournal: z.boolean().default(false),
});

export const UpdateBankAccountSchema = z.object({
  accountName: z.string().min(1).max(100).optional(),
  accountType: BankAccountTypeEnum.optional(),
  accountNumberMasked: z.string().max(30).optional().nullable(),
  routingNumber: z.string().max(30).optional().nullable(),
  institutionName: z.string().max(100).optional().nullable(),
  linkedLedgerAccountId: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

// Bank Transaction Validation
export const CreateBankTransactionSchema = z.object({
  bankAccountId: z.string().min(1, "Bank account is required"),
  transactionDate: z.string().or(z.date()),
  valueDate: z.string().or(z.date()).optional().nullable(),
  description: z.string().min(1, "Description is required").max(255),
  reference: z.string().max(100).optional().nullable(),
  amount: z.number().refine((val) => val !== 0, "Amount cannot be zero"),
  transactionType: BankTransactionTypeEnum,
  payee: z.string().max(150).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  memo: z.string().max(500).optional().nullable(),
  targetLedgerAccountId: z.string().optional().nullable(),
});

export const CategorizeTransactionSchema = z.object({
  category: z.string().min(1, "Category is required").max(100),
  targetLedgerAccountId: z.string().min(1, "Target ledger account is required"),
  payee: z.string().max(150).optional().nullable(),
  memo: z.string().max(500).optional().nullable(),
});

// Bank Transfer Validation
export const CreateBankTransferSchema = z.object({
  fromBankAccountId: z.string().min(1, "Source bank account is required"),
  toBankAccountId: z.string().min(1, "Destination bank account is required"),
  amount: z.number().positive("Transfer amount must be greater than zero"),
  feeAmount: z.number().min(0, "Fee cannot be negative").default(0),
  transferDate: z.string().or(z.date()),
  reference: z.string().max(100).optional().nullable(),
  memo: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().max(100).optional().nullable(),
}).refine((data) => data.fromBankAccountId !== data.toBankAccountId, {
  message: "Source and destination accounts must be different",
  path: ["toBankAccountId"],
});

// Matching Validation
export const MatchTargetTypeEnum = z.enum([
  "CUSTOMER_PAYMENT",
  "VENDOR_PAYMENT",
  "JOURNAL_ENTRY",
  "BANK_TRANSFER",
]);

export const MatchTransactionSchema = z.object({
  bankTransactionId: z.string().min(1, "Bank transaction ID is required"),
  targetType: MatchTargetTypeEnum,
  targetId: z.string().min(1, "Target record ID is required"),
});

export const UnmatchTransactionSchema = z.object({
  bankTransactionId: z.string().min(1, "Bank transaction ID is required"),
});

// Reconciliation Validation
export const StartReconciliationSchema = z.object({
  bankAccountId: z.string().min(1, "Bank account is required"),
  statementStartDate: z.string().or(z.date()),
  statementEndDate: z.string().or(z.date()),
  statementEndingBalance: z.number(),
  notes: z.string().max(500).optional().nullable(),
});

export const ToggleReconciliationItemSchema = z.object({
  bankTransactionId: z.string().min(1, "Bank transaction ID is required"),
  isCleared: z.boolean(),
});

export const CompleteReconciliationSchema = z.object({
  notes: z.string().max(500).optional().nullable(),
});

// Import Validation
export const CsvColumnMappingSchema = z.object({
  dateColumn: z.string().min(1, "Date column mapping is required"),
  descriptionColumn: z.string().min(1, "Description column mapping is required"),
  amountColumn: z.string().optional().nullable(),
  inflowColumn: z.string().optional().nullable(),
  outflowColumn: z.string().optional().nullable(),
  referenceColumn: z.string().optional().nullable(),
  payeeColumn: z.string().optional().nullable(),
  dateFormat: z.string().default("YYYY-MM-DD"),
  hasHeader: z.boolean().default(true),
  delimiter: z.string().default(","),
}).refine(
  (data) => Boolean(data.amountColumn || (data.inflowColumn && data.outflowColumn)),
  {
    message: "Either Amount column or both Inflow and Outflow columns must be specified",
    path: ["amountColumn"],
  }
);

export const BankImportPreviewSchema = z.object({
  bankAccountId: z.string().min(1, "Bank account is required"),
  csvContent: z.string().min(1, "CSV content is required"),
  mapping: CsvColumnMappingSchema,
});

export const BankImportCommitSchema = z.object({
  bankAccountId: z.string().min(1, "Bank account is required"),
  fileName: z.string().min(1, "File name is required"),
  csvContent: z.string().min(1, "CSV content is required"),
  mapping: CsvColumnMappingSchema,
});

export type CreateBankAccountInput = z.input<typeof CreateBankAccountSchema>;
export type UpdateBankAccountInput = z.input<typeof UpdateBankAccountSchema>;
export type CreateBankTransactionInput = z.input<typeof CreateBankTransactionSchema>;
export type CategorizeTransactionInput = z.input<typeof CategorizeTransactionSchema>;
export type CreateBankTransferInput = z.input<typeof CreateBankTransferSchema>;
export type MatchTransactionInput = z.input<typeof MatchTransactionSchema>;
export type StartReconciliationInput = z.input<typeof StartReconciliationSchema>;
export type CsvColumnMapping = z.input<typeof CsvColumnMappingSchema>;
export type BankImportPreviewInput = z.input<typeof BankImportPreviewSchema>;
export type BankImportCommitInput = z.input<typeof BankImportCommitSchema>;
