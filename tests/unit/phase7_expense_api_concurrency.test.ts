import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExpenseService } from "@/server/services/ExpenseService";
import { ExpenseApprovalService } from "@/server/services/ExpenseApprovalService";
import { ExpensePostingService } from "@/server/services/ExpensePostingService";
import { ExpensePaymentService } from "@/server/services/ExpensePaymentService";
import { SessionUser } from "@/types/auth";
import { ConflictError, ValidationError } from "@/lib/errors";
import { db } from "@/db/client";

vi.mock("@/db/client", () => {
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
    },
    expenseCategory: {
      findFirst: vi.fn(),
    },
    bankAccount: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    bankTransaction: {
      create: vi.fn(),
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
  return { db: client };
});

vi.mock("@/server/services/AccountingPeriodService", () => ({
  AccountingPeriodService: {
    assertOpenPeriod: vi.fn().mockResolvedValue({ id: "period_1", name: "2026-09" }),
  },
}));

vi.mock("@/server/services/AccountMappingService", () => ({
  AccountMappingService: {
    resolveAccount: vi.fn().mockResolvedValue({ id: "acc_default", accountCode: "5000" }),
  },
}));

describe("Phase 7: Expense Concurrency & Financial Serialization Suite", () => {
  const adminUser: SessionUser = {
    id: "usr_admin",
    email: "admin@acme.com",
    name: "Admin User",
    activeOrganizationId: "org_alpha",
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Document Auto-Numbering Concurrency & Collision Retries", () => {
    it("handles concurrent creation collision by retrying sequence counter up to 5 attempts", async () => {
      (db.expense.count as any).mockResolvedValue(10);
      (db.bankAccount.findFirst as any).mockResolvedValue({
        id: "bank_1",
        accountName: "Checking",
        isActive: true,
      });

      // First count yields EXP-2026-00011 which collides; second attempt EXP-2026-00012 succeeds
      (db.expense.findFirst as any)
        .mockResolvedValueOnce({ id: "exp_existing", expenseNumber: "EXP-2026-00011" })
        .mockResolvedValueOnce(null);

      (db.expense.create as any).mockImplementation(async ({ data }: any) => ({
        id: "exp_new",
        expenseNumber: data.expenseNumber,
        ...data,
      }));

      const created = await ExpenseService.createExpense(adminUser, {
        expenseType: "DIRECT_BUSINESS",
        paymentType: "PAID_IMMEDIATELY",
        expenseDate: "2026-09-25",
        description: "Concurrent Equipment Purchase",
        bankAccountId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        lines: [
          {
            description: "Workstation",
            quantity: 1,
            unitPrice: 1200,
          },
        ],
      });

      expect(created.expenseNumber).toBe("EXP-2026-00012");
      expect(db.expense.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("2. Concurrent Approvals Serialization", () => {
    it("ensures duplicate concurrent approvals fail with ConflictError on already approved expense", async () => {
      let callCount = 0;
      (db.expense.findFirst as any).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            id: "exp_101",
            organizationId: "org_alpha",
            status: "SUBMITTED",
            claimantId: "usr_other",
          };
        }
        return {
          id: "exp_101",
          organizationId: "org_alpha",
          status: "APPROVED", // Already transitioned by call 1
          claimantId: "usr_other",
        };
      });

      (db.expense.update as any).mockResolvedValue({
        id: "exp_101",
        status: "APPROVED",
      });

      // Call 1 succeeds
      const first = await ExpenseApprovalService.approve(adminUser, "exp_101");
      expect(first.status).toBe("APPROVED");

      // Call 2 fails
      await expect(
        ExpenseApprovalService.approve(adminUser, "exp_101")
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("3. Idempotent GL Posting Under Concurrency", () => {
    it("ensures duplicate concurrent posting calls return existing journal via AccountingEvent lock", async () => {
      (db.expense.findFirst as any).mockResolvedValue({
        id: "exp_201",
        organizationId: "org_alpha",
        expenseNumber: "EXP-2026-00021",
        expenseType: "DIRECT_BUSINESS",
        paymentType: "ON_ACCOUNT",
        status: "APPROVED",
        expenseDate: new Date("2026-09-25"),
        total: 500,
        taxTotal: 0,
        lines: [
          {
            description: "Server hosting",
            subtotal: 500,
            category: { linkedExpenseAccount: { id: "acc_host" } },
          },
        ],
      });

      // Simulates AccountingEvent already exists with journalEntryId
      (db.accountingEvent.findUnique as any).mockResolvedValue({
        id: "event_1",
        journalEntryId: "je_existing_1",
      });

      (db.journalEntry.findUnique as any).mockResolvedValue({
        id: "je_existing_1",
        journalNumber: "JE-000001",
        status: "POSTED",
      });

      const journal = await ExpensePostingService.postExpense(adminUser, "exp_201");
      expect(journal?.id).toBe("je_existing_1");
      // Does not create a second journal entry
      expect(db.journalEntry.create).not.toHaveBeenCalled();
    });
  });

  describe("4. Payment Execution & Settlement Concurrency", () => {
    it("ensures duplicate concurrent payExpense calls return existing settled expense idempotently", async () => {
      (db.bankAccount.findFirst as any).mockResolvedValue({
        id: "bank_1",
        organizationId: "org_alpha",
        accountName: "Operating Account",
        isActive: true,
      });

      // Simulates expense is already PAID
      (db.expense.findFirst as any).mockResolvedValue({
        id: "exp_301",
        organizationId: "org_alpha",
        expenseNumber: "EXP-2026-00031",
        status: "PAID",
        total: 150,
      });

      const result = await ExpensePaymentService.payExpense(adminUser, "exp_301", {
        bankAccountId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      });

      expect(result.status).toBe("PAID");
      expect(db.bankTransaction.create).not.toHaveBeenCalled();
      expect(db.bankAccount.update).not.toHaveBeenCalled();
    });
  });

  describe("5. Voiding Concurrency", () => {
    it("ensures duplicate concurrent voidExpense calls throw ConflictError on already voided expense", async () => {
      (db.expense.findFirst as any).mockResolvedValue({
        id: "exp_401",
        organizationId: "org_alpha",
        expenseNumber: "EXP-2026-00041",
        status: "VOIDED",
      });

      await expect(
        ExpensePaymentService.voidExpense(adminUser, "exp_401", "Void attempt")
      ).rejects.toThrow(ConflictError);
    });
  });
});
