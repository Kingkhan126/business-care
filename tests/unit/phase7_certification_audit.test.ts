import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExpensePostingService } from "@/server/services/ExpensePostingService";
import { ExpensePaymentService } from "@/server/services/ExpensePaymentService";
import { ExpenseApprovalService } from "@/server/services/ExpenseApprovalService";
import { ExpenseService } from "@/server/services/ExpenseService";
import { CalculationEngine } from "@/server/services/CalculationEngine";
import { AccountMappingService } from "@/server/services/AccountMappingService";
import { AccountingPeriodService } from "@/server/services/AccountingPeriodService";
import { ExpenseAuditAction } from "@/lib/audit/expenseEvents";
import { SessionUser } from "@/types/auth";
import {
  ExpenseType,
  ExpenseStatus,
  ExpensePaymentType,
  BankTransactionType,
  BankTransactionStatus,
  BankTransactionSource,
  JournalSource,
  Prisma,
} from "@prisma/client";
import { ForbiddenError, ValidationError, ConflictError, NotFoundError } from "@/lib/errors";

const { mockDb } = vi.hoisted(() => {
  const client: any = {
    $transaction: vi.fn(async (cb) => cb(client)),
    $queryRaw: vi.fn().mockResolvedValue([]),
    expense: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    expenseLine: {
      createMany: vi.fn(),
    },
    expenseCategory: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bankAccount: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    bankTransaction: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    journalEntry: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    accountingEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return { mockDb: client };
});

vi.mock("@/db/client", () => ({
  db: mockDb,
}));

vi.mock("@/server/services/AccountingPeriodService", () => ({
  AccountingPeriodService: {
    assertOpenPeriod: vi.fn().mockResolvedValue({ id: "period_open_2026_09", name: "2026-09" }),
  },
}));

vi.mock("@/server/services/AccountMappingService", () => ({
  AccountMappingService: {
    resolveAccount: vi.fn().mockImplementation(async (orgId: string, mappingKey: string) => {
      const mappingDict: Record<string, { id: string; accountCode: string; accountName: string }> = {
        DEFAULT_EXPENSE: { id: "acc_exp_default", accountCode: "6100", accountName: "General Expense" },
        TAX_RECOVERABLE: { id: "acc_tax_rec", accountCode: "1400", accountName: "Input Tax Recoverable" },
        EMPLOYEE_REIMBURSEMENTS_PAYABLE: {
          id: "acc_emp_payable",
          accountCode: "2150",
          accountName: "Employee Reimbursements Payable",
        },
        ACCOUNTS_PAYABLE: { id: "acc_ap", accountCode: "2000", accountName: "Accounts Payable" },
        BANK: { id: "acc_bank_default", accountCode: "1010", accountName: "Operating Bank Account" },
      };
      if (mappingDict[mappingKey]) {
        return mappingDict[mappingKey];
      }
      return { id: `acc_${mappingKey.toLowerCase()}`, accountCode: "9999", accountName: mappingKey };
    }),
  },
}));

describe("Phase 7 Step 7: Final Certification, Financial Integrity & Security Audit Suite", () => {
  const adminUser: SessionUser = {
    id: "usr_admin",
    email: "controller@enterprise.com",
    name: "Financial Controller",
    activeOrganizationId: "org_acme_corp",
    roleName: "Owner",
    permissions: [
      "expense.read",
      "expense.create",
      "expense.update",
      "expense.submit",
      "expense.approve",
      "expense.reject",
      "expense.post",
      "expense.pay",
      "expense.manage",
      "expense.attachments",
      "expense.reports",
    ],
  };

  const employeeUser: SessionUser = {
    id: "usr_employee",
    email: "emp@enterprise.com",
    name: "Claimant Employee",
    activeOrganizationId: "org_acme_corp",
    roleName: "Member",
    permissions: [
      "expense.read",
      "expense.create",
      "expense.update",
      "expense.submit",
      "expense.attachments",
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // SECTION 1: DIRECT BUSINESS EXPENSE AUDIT
  // ==========================================
  describe("1. Direct Business Expense Immediate Payment Audit", () => {
    it("should execute immediate payment posting with exact GL debits, GL credit to bank, Phase 6 BankTransaction, and operational balance decrement", async () => {
      const expenseFixture = {
        id: "exp_direct_imm_01",
        organizationId: "org_acme_corp",
        expenseNumber: "EXP-2026-00100",
        expenseType: ExpenseType.DIRECT_BUSINESS,
        paymentType: ExpensePaymentType.PAID_IMMEDIATELY,
        status: ExpenseStatus.APPROVED,
        expenseDate: new Date("2026-09-15"),
        description: "Office Supplies and Software",
        subtotal: 500.0,
        taxTotal: 50.0,
        total: 550.0,
        currency: "USD",
        bankAccountId: "bnk_op_01",
        bankAccount: {
          id: "bnk_op_01",
          accountName: "Operating Checking",
          linkedLedgerAccount: { id: "acc_bank_gl", accountCode: "1010", accountName: "Checking Ledger" },
        },
        lines: [
          {
            description: "Printer Paper",
            subtotal: 500.0,
            taxRate: 10,
            category: {
              linkedExpenseAccount: { id: "acc_supplies", accountCode: "6200", accountName: "Office Supplies" },
            },
          },
        ],
        supplier: { id: "sup_staples", displayName: "Staples Business" },
      };

      mockDb.expense.findFirst.mockResolvedValue(expenseFixture);
      mockDb.accountingEvent.findUnique.mockResolvedValue(null);
      mockDb.journalEntry.count.mockResolvedValue(12);
      mockDb.journalEntry.create.mockImplementation(({ data }: any) => ({
        id: "je_exp_001",
        journalNumber: data.journalNumber,
        ...data,
      }));
      mockDb.bankTransaction.create.mockImplementation(({ data }: any) => ({
        id: "btx_001",
        ...data,
      }));

      const journal = await ExpensePostingService.postExpense(adminUser, "exp_direct_imm_01");

      // Verify Journal Entry creation
      expect(journal).toBeDefined();
      expect(mockDb.journalEntry.create).toHaveBeenCalledTimes(1);
      const jeData = mockDb.journalEntry.create.mock.calls[0][0].data;
      expect(jeData.totalDebit).toBe(550.0);
      expect(jeData.totalCredit).toBe(550.0);

      // Verify DR Expense, DR Tax, CR Bank
      expect(jeData.lines.create).toHaveLength(3);
      expect(jeData.lines.create[0]).toMatchObject({
        accountId: "acc_supplies",
        debit: 500.0,
        credit: 0,
      });
      expect(jeData.lines.create[1]).toMatchObject({
        accountId: "acc_tax_rec",
        debit: 50.0,
        credit: 0,
      });
      expect(jeData.lines.create[2]).toMatchObject({
        accountId: "acc_bank_gl",
        debit: 0,
        credit: 550.0,
      });

      // Verify Phase 6 Bank Transaction created with WITHDRAWAL convention (amount < 0)
      expect(mockDb.bankTransaction.create).toHaveBeenCalledTimes(1);
      const btxData = mockDb.bankTransaction.create.mock.calls[0][0].data;
      expect(btxData).toMatchObject({
        organizationId: "org_acme_corp",
        bankAccountId: "bnk_op_01",
        amount: -550.0,
        transactionType: BankTransactionType.WITHDRAWAL,
        status: BankTransactionStatus.MATCHED,
        source: BankTransactionSource.MANUAL,
        matchedJournalEntryId: "je_exp_001",
      });

      // Verify BankAccount currentBalance decremented
      expect(mockDb.bankAccount.update).toHaveBeenCalledWith({
        where: { id: "bnk_op_01" },
        data: { currentBalance: { decrement: 550.0 } },
      });

      // Verify Expense status set to PAID
      expect(mockDb.expense.update).toHaveBeenCalledWith({
        where: { id: "exp_direct_imm_01" },
        data: expect.objectContaining({
          status: ExpenseStatus.PAID,
          journalEntryId: "je_exp_001",
        }),
      });

      // Verify Audit Logs
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: ExpenseAuditAction.EXPENSE_POSTED,
          entityId: "exp_direct_imm_01",
        }),
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: ExpenseAuditAction.EXPENSE_PAID,
          entityId: "exp_direct_imm_01",
        }),
      });
    });

    it("should prevent duplicate settlement when immediate payment is posted again or paid again", async () => {
      const settledExpenseFixture = {
        id: "exp_direct_imm_01",
        organizationId: "org_acme_corp",
        expenseNumber: "EXP-2026-00100",
        expenseType: ExpenseType.DIRECT_BUSINESS,
        paymentType: ExpensePaymentType.PAID_IMMEDIATELY,
        status: ExpenseStatus.PAID,
        total: 550.0,
        journalEntryId: "je_exp_001",
      };

      mockDb.expense.findFirst.mockResolvedValue(settledExpenseFixture);
      mockDb.accountingEvent.findUnique.mockResolvedValue({
        id: "ev_001",
        journalEntryId: "je_exp_001",
      });
      mockDb.journalEntry.findUnique.mockResolvedValue({
        id: "je_exp_001",
        journalNumber: "JE-000013",
      });

      // Attempt second POST
      const resPost = await ExpensePostingService.postExpense(adminUser, "exp_direct_imm_01");
      expect(resPost).toMatchObject({ id: "je_exp_001" });
      expect(mockDb.journalEntry.create).not.toHaveBeenCalled();
      expect(mockDb.bankTransaction.create).not.toHaveBeenCalled();
      expect(mockDb.bankAccount.update).not.toHaveBeenCalled();

      // Attempt subsequent PAY
      const validBankCuid = "cly0000000000000000000001";
      mockDb.bankAccount.findFirst.mockResolvedValue({
        id: validBankCuid,
        organizationId: "org_acme_corp",
        isActive: true,
      });
      const resPay = await ExpensePaymentService.payExpense(adminUser, "exp_direct_imm_01", {
        bankAccountId: validBankCuid,
      });
      expect(resPay).toMatchObject({ id: "exp_direct_imm_01", status: ExpenseStatus.PAID });
      expect(mockDb.bankTransaction.create).not.toHaveBeenCalled();
      expect(mockDb.bankAccount.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // SECTION 2: EMPLOYEE REIMBURSEMENT AUDIT
  // ==========================================
  describe("2. Employee Reimbursement Lifecycle & Liability Audit", () => {
    it("should create liability to EMPLOYEE_REIMBURSEMENTS_PAYABLE on post, and settle liability with bank credit on disbursement", async () => {
      const claimFixture = {
        id: "exp_claim_01",
        organizationId: "org_acme_corp",
        expenseNumber: "EXP-2026-00200",
        expenseType: ExpenseType.EMPLOYEE_CLAIM,
        paymentType: ExpensePaymentType.ON_ACCOUNT,
        status: ExpenseStatus.APPROVED,
        expenseDate: new Date("2026-09-20"),
        description: "Travel expenses for client onsite",
        subtotal: 1200.0,
        taxTotal: 0.0,
        total: 1200.0,
        claimantId: "usr_employee",
        claimant: { id: "usr_employee", name: "Claimant Employee", email: "emp@enterprise.com" },
        lines: [
          {
            description: "Airfare and lodging",
            subtotal: 1200.0,
            taxRate: 0,
            category: {
              linkedExpenseAccount: { id: "acc_travel", accountCode: "6300", accountName: "Travel & Lodging" },
            },
          },
        ],
      };

      mockDb.expense.findFirst.mockResolvedValue(claimFixture);
      mockDb.accountingEvent.findUnique.mockResolvedValue(null);
      mockDb.journalEntry.count.mockResolvedValue(20);
      mockDb.journalEntry.create.mockImplementation(({ data }: any) => ({
        id: "je_claim_accrual",
        journalNumber: data.journalNumber,
        ...data,
      }));

      // STEP 1: Post Claim to General Ledger
      await ExpensePostingService.postExpense(adminUser, "exp_claim_01");

      expect(mockDb.journalEntry.create).toHaveBeenCalledTimes(1);
      const accrualData = mockDb.journalEntry.create.mock.calls[0][0].data;
      expect(accrualData.totalDebit).toBe(1200.0);
      expect(accrualData.totalCredit).toBe(1200.0);

      // Verify DR Travel Expense, CR Employee Reimbursements Payable
      expect(accrualData.lines.create).toHaveLength(2);
      expect(accrualData.lines.create[0]).toMatchObject({
        accountId: "acc_travel",
        debit: 1200.0,
        credit: 0,
      });
      expect(accrualData.lines.create[1]).toMatchObject({
        accountId: "acc_emp_payable",
        debit: 0,
        credit: 1200.0,
      });

      // Verify Expense status transitioned to POSTED (not PAID yet)
      expect(mockDb.expense.update).toHaveBeenCalledWith({
        where: { id: "exp_claim_01" },
        data: expect.objectContaining({
          status: ExpenseStatus.POSTED,
          journalEntryId: "je_claim_accrual",
        }),
      });

      // STEP 2: Disburse Reimbursement Payment
      const postedClaimFixture = {
        ...claimFixture,
        status: ExpenseStatus.POSTED,
        journalEntryId: "je_claim_accrual",
      };
      mockDb.expense.findFirst.mockResolvedValue(postedClaimFixture);
      const validBankCuid = "cly0000000000000000000001";
      mockDb.bankAccount.findFirst.mockResolvedValue({
        id: validBankCuid,
        organizationId: "org_acme_corp",
        accountName: "Operating Checking",
        isActive: true,
        linkedLedgerAccount: { id: "acc_bank_gl", accountCode: "1010", accountName: "Checking Ledger" },
      });
      mockDb.journalEntry.create.mockImplementation(({ data }: any) => ({
        id: "je_claim_settlement",
        journalNumber: data.journalNumber,
        ...data,
      }));
      mockDb.expense.update.mockResolvedValue({
        ...postedClaimFixture,
        status: ExpenseStatus.PAID,
        reimbursementJournalId: "je_claim_settlement",
      });

      const resPayment = await ExpensePaymentService.payExpense(adminUser, "exp_claim_01", {
        bankAccountId: validBankCuid,
        reference: "ACH-EMP-REIMB-8891",
      });

      // Verify Settlement Journal Entry: DR Employee Reimbursements Payable, CR Bank
      expect(mockDb.journalEntry.create).toHaveBeenCalledTimes(2);
      const settlementData = mockDb.journalEntry.create.mock.calls[1][0].data;
      expect(settlementData.source).toBe(JournalSource.EMPLOYEE_REIMBURSEMENT);
      expect(settlementData.lines.create).toHaveLength(2);
      expect(settlementData.lines.create[0]).toMatchObject({
        accountId: "acc_emp_payable",
        debit: 1200.0,
        credit: 0,
      });
      expect(settlementData.lines.create[1]).toMatchObject({
        accountId: "acc_bank_gl",
        debit: 0,
        credit: 1200.0,
      });

      // Verify BankTransaction WITHDRAWAL created
      expect(mockDb.bankTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bankAccountId: validBankCuid,
          amount: -1200.0,
          transactionType: BankTransactionType.WITHDRAWAL,
          matchedJournalEntryId: "je_claim_settlement",
        }),
      });

      // Verify Bank Account balance decremented
      expect(mockDb.bankAccount.update).toHaveBeenCalledWith({
        where: { id: validBankCuid },
        data: { currentBalance: { decrement: 1200.0 } },
      });

      expect(resPayment.status).toBe(ExpenseStatus.PAID);
    });
  });

  // ==========================================
  // SECTION 3: BANKING RECONCILIATION & VOID AUDIT
  // ==========================================
  describe("3. Banking Boundary & Void Integrity Audit", () => {
    it("should accurately restore bank balance on voiding an unreconciled paid expense", async () => {
      const paidExpense = {
        id: "exp_to_void",
        organizationId: "org_acme_corp",
        expenseNumber: "EXP-2026-00555",
        status: ExpenseStatus.PAID,
        total: 300.0,
        journalEntryId: "je_orig",
        reimbursementJournalId: "je_reimb",
      };

      mockDb.expense.findFirst.mockResolvedValue(paidExpense);
      mockDb.journalEntry.findUnique.mockImplementation(({ where }: any) => ({
        id: where.id,
        status: "POSTED",
        journalNumber: `JE-${where.id}`,
        totalDebit: 300.0,
        totalCredit: 300.0,
        accountingPeriodId: "period_open_2026_09",
        lines: [
          { accountId: "acc_emp_payable", debit: 300.0, credit: 0 },
          { accountId: "acc_bank_gl", debit: 0, credit: 300.0 },
        ],
      }));

      // Bank transaction is MATCHED (not reconciled)
      mockDb.bankTransaction.findMany.mockResolvedValue([
        {
          id: "bt_reimb_01",
          bankAccountId: "bnk_op_01",
          amount: -300.0,
          status: BankTransactionStatus.MATCHED,
        },
      ]);

      await ExpensePaymentService.voidExpense(adminUser, "exp_to_void", "Duplicate claim entered by mistake");

      // Verify Reversing Journal Entries created with inverted lines
      expect(mockDb.journalEntry.create).toHaveBeenCalled();
      const revCall = mockDb.journalEntry.create.mock.calls[0][0].data;
      expect(revCall.reversedEntryId).toBe("je_reimb");
      expect(revCall.lines.create[0]).toMatchObject({
        accountId: "acc_emp_payable",
        debit: 0,
        credit: 300.0,
      });
      expect(revCall.lines.create[1]).toMatchObject({
        accountId: "acc_bank_gl",
        debit: 300.0,
        credit: 0,
      });

      // Verify Bank Account Balance Decrement with negative amount (mathematical restoration: -(-300) = +300)
      expect(mockDb.bankAccount.update).toHaveBeenCalledWith({
        where: { id: "bnk_op_01" },
        data: { currentBalance: { decrement: -300.0 } },
      });

      // Verify BankTransaction marked VOIDED
      expect(mockDb.bankTransaction.update).toHaveBeenCalledWith({
        where: { id: "bt_reimb_01" },
        data: expect.objectContaining({
          status: BankTransactionStatus.VOIDED,
          matchedJournalEntryId: null,
        }),
      });

      // Verify expense marked VOIDED
      expect(mockDb.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "exp_to_void" },
          data: expect.objectContaining({
            status: ExpenseStatus.VOIDED,
          }),
        })
      );
    });

    it("should strictly reject voiding an expense if associated bank transaction is already reconciled", async () => {
      const paidExpense = {
        id: "exp_reconciled",
        organizationId: "org_acme_corp",
        expenseNumber: "EXP-2026-00777",
        status: ExpenseStatus.PAID,
        total: 450.0,
        journalEntryId: "je_orig",
        reimbursementJournalId: "je_reimb",
      };

      mockDb.expense.findFirst.mockResolvedValue(paidExpense);
      mockDb.journalEntry.findUnique.mockReturnValue({
        id: "je_orig",
        status: "POSTED",
        lines: [],
      });
      mockDb.bankTransaction.findMany.mockResolvedValue([
        {
          id: "bt_reconciled_01",
          bankAccountId: "bnk_op_01",
          amount: -450.0,
          status: BankTransactionStatus.RECONCILED, // Reconciled!
        },
      ]);

      await expect(
        ExpensePaymentService.voidExpense(adminUser, "exp_reconciled", "Attempt to void reconciled")
      ).rejects.toThrow("Cannot void expense because associated bank transaction has already been reconciled.");
    });
  });

  // ==========================================
  // SECTION 4: ANTI-SELF-APPROVAL AUDIT
  // ==========================================
  describe("4. Internal Controls: Anti-Self-Approval Enforcement", () => {
    it("should strictly reject claim approval when claimant attempts to approve their own claim", async () => {
      const selfClaim = {
        id: "exp_self_claim",
        organizationId: "org_acme_corp",
        expenseNumber: "EXP-2026-00999",
        expenseType: ExpenseType.EMPLOYEE_CLAIM,
        status: ExpenseStatus.SUBMITTED,
        claimantId: "usr_employee", // Sarah is claimant
      };

      mockDb.expense.findFirst.mockResolvedValue(selfClaim);

      // Claimant has approve permission in this test to verify self-approval block
      const claimantWithApprovePerm: SessionUser = {
        ...employeeUser,
        permissions: [...employeeUser.permissions, "expense.approve"],
      };

      await expect(
        ExpenseApprovalService.approve(claimantWithApprovePerm, "exp_self_claim")
      ).rejects.toThrow("Claimants are strictly prohibited from approving their own expense claims.");
    });

    it("should permit approval by an authorized independent reviewer", async () => {
      const selfClaim = {
        id: "exp_valid_claim",
        organizationId: "org_acme_corp",
        expenseNumber: "EXP-2026-00999",
        expenseType: ExpenseType.EMPLOYEE_CLAIM,
        status: ExpenseStatus.SUBMITTED,
        claimantId: "usr_employee",
      };

      mockDb.expense.findFirst.mockResolvedValue(selfClaim);
      mockDb.expense.update.mockResolvedValue({
        ...selfClaim,
        status: ExpenseStatus.APPROVED,
        approvedById: adminUser.id,
      });

      const approved = await ExpenseApprovalService.approve(adminUser, "exp_valid_claim");
      expect(approved.status).toBe(ExpenseStatus.APPROVED);
      expect(mockDb.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "exp_valid_claim" },
          data: expect.objectContaining({
            status: ExpenseStatus.APPROVED,
            approvedById: adminUser.id,
          }),
        })
      );
    });
  });

  // ==========================================
  // SECTION 5: ACCOUNTING PERIOD AUDIT
  // ==========================================
  describe("5. Accounting Period Locking Boundary Audit", () => {
    it("should prevent posting an expense when the accounting period is closed", async () => {
      const { AccountingPeriodService } = await import("@/server/services/AccountingPeriodService");
      vi.mocked(AccountingPeriodService.assertOpenPeriod).mockRejectedValueOnce(
        new ValidationError("Accounting period for date 2026-09-15 is CLOSED. No postings allowed.")
      );

      const expenseFixture = {
        id: "exp_closed_period",
        organizationId: "org_acme_corp",
        expenseNumber: "EXP-2026-00333",
        expenseType: ExpenseType.DIRECT_BUSINESS,
        paymentType: ExpensePaymentType.PAID_IMMEDIATELY,
        status: ExpenseStatus.APPROVED,
        expenseDate: new Date("2026-09-15"),
        total: 100.0,
        lines: [{ description: "Supplies", subtotal: 100.0, taxRate: 0 }],
      };

      mockDb.expense.findFirst.mockResolvedValue(expenseFixture);

      await expect(
        ExpensePostingService.postExpense(adminUser, "exp_closed_period")
      ).rejects.toThrow("Accounting period for date 2026-09-15 is CLOSED");
    });
  });

  // ==========================================
  // SECTION 6: DECIMAL / MONEY PRECISION AUDIT
  // ==========================================
  describe("6. Decimal Arithmetic & Banking Rounding Precision Audit", () => {
    it("should prevent floating point anomalies (0.1 + 0.2) and round fractional cents using ROUND_HALF_UP", () => {
      // Direct floating point would produce 0.30000000000000004
      const moneySum = CalculationEngine.roundMoney(0.1 + 0.2);
      expect(moneySum).toBe(0.3);

      // Fractional cent rounding: 10.005 rounds up to 10.01
      const halfUp = CalculationEngine.roundMoney(10.005);
      expect(halfUp).toBe(10.01);

      // Line item calculation with odd tax rate (8.875% NYC tax on $33.33)
      const line = CalculationEngine.calculateLine({
        description: "Specialized item",
        quantity: 1,
        unitPrice: 33.33,
        taxRate: 8.875,
      });

      // 33.33 * 0.08875 = 2.9579875 -> rounds to 2.96
      expect(line.taxAmount).toBe(2.96);
      // Subtotal 33.33 + Tax 2.96 = 36.29
      expect(line.total).toBe(36.29);
    });
  });

  // ==========================================
  // SECTION 7: MULTI-TENANT ISOLATION AUDIT
  // ==========================================
  describe("7. Multi-Tenant Boundary Audit", () => {
    it("should return NotFoundError when attempting to operate on an expense belonging to a different organization", async () => {
      // FindFirst with orgId filter returns null for cross-tenant
      mockDb.expense.findFirst.mockResolvedValue(null);

      await expect(
        ExpenseService.getExpenseById(adminUser, "exp_other_tenant_999")
      ).rejects.toThrow(NotFoundError);

      await expect(
        ExpenseApprovalService.approve(adminUser, "exp_other_tenant_999")
      ).rejects.toThrow(NotFoundError);

      await expect(
        ExpensePostingService.postExpense(adminUser, "exp_other_tenant_999")
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================
  // SECTION 8: LIFECYCLE TRANSITION INTEGRITY
  // ==========================================
  describe("8. State Machine & Forbidden Lifecycle Transitions", () => {
    it("should reject illegal state transitions according to financial control policies", async () => {
      // 1. DRAFT -> POSTED (forbidden)
      mockDb.expense.findFirst.mockResolvedValue({
        id: "exp_draft",
        organizationId: "org_acme_corp",
        expenseNumber: "EXP-DRAFT",
        status: ExpenseStatus.DRAFT,
      });
      await expect(
        ExpensePostingService.postExpense(adminUser, "exp_draft")
      ).rejects.toThrow("cannot be posted. Expected APPROVED.");

      // 2. REJECTED -> POSTED (forbidden)
      mockDb.expense.findFirst.mockResolvedValue({
        id: "exp_rejected",
        organizationId: "org_acme_corp",
        expenseNumber: "EXP-REJ",
        status: ExpenseStatus.REJECTED,
      });
      await expect(
        ExpensePostingService.postExpense(adminUser, "exp_rejected")
      ).rejects.toThrow("cannot be posted. Expected APPROVED.");

      // 3. SUBMITTED -> PAID (forbidden)
      const validBankCuid = "cly0000000000000000000001";
      mockDb.expense.findFirst.mockResolvedValue({
        id: "exp_sub",
        organizationId: "org_acme_corp",
        expenseNumber: "EXP-SUB",
        status: ExpenseStatus.SUBMITTED,
      });
      mockDb.bankAccount.findFirst.mockResolvedValue({ id: validBankCuid, isActive: true });
      await expect(
        ExpensePaymentService.payExpense(adminUser, "exp_sub", { bankAccountId: validBankCuid })
      ).rejects.toThrow("cannot be paid. Must be APPROVED or POSTED.");

      // 4. VOIDED -> PAID (forbidden)
      mockDb.expense.findFirst.mockResolvedValue({
        id: "exp_void",
        organizationId: "org_acme_corp",
        expenseNumber: "EXP-VOID",
        status: ExpenseStatus.VOIDED,
      });
      await expect(
        ExpensePaymentService.payExpense(adminUser, "exp_void", { bankAccountId: validBankCuid })
      ).rejects.toThrow("is voided and cannot be paid.");
    });
  });
});
