import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExpenseApprovalService } from "@/server/services/ExpenseApprovalService";
import { ExpenseCategoryService } from "@/server/services/ExpenseCategoryService";
import { ExpensePaymentService } from "@/server/services/ExpensePaymentService";
import { ExpensePostingService } from "@/server/services/ExpensePostingService";
import { ExpenseService } from "@/server/services/ExpenseService";
import { CreateExpenseSchema, PayExpenseSchema } from "@/lib/validation/expense";
import { SessionUser } from "@/types/auth";
import { ForbiddenError, ValidationError, ConflictError, NotFoundError } from "@/lib/errors";
import { db } from "@/db/client";

// Mock Prisma DB client
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

describe("Phase 7: Expense Management & Reimbursements Domain Services Suite", () => {
  const claimantUser: SessionUser = {
    id: "usr_claimant",
    email: "sarah@acme.com",
    name: "Sarah Chen",
    activeOrganizationId: "org_alpha",
    roleName: "Member",
    permissions: [
      "expense.read",
      "expense.create",
      "expense.update",
      "expense.submit",
      "expense.attachments",
    ],
  };

  const managerUser: SessionUser = {
    id: "usr_manager",
    email: "marcus@acme.com",
    name: "Marcus Brody",
    activeOrganizationId: "org_alpha",
    roleName: "Manager",
    permissions: [
      "expense.read",
      "expense.create",
      "expense.update",
      "expense.submit",
      "expense.approve",
      "expense.reject",
      "expense.attachments",
      "expense.reports",
    ],
  };

  const accountantUser: SessionUser = {
    id: "usr_accountant",
    email: "accountant@acme.com",
    name: "Alex Vance",
    activeOrganizationId: "org_alpha",
    roleName: "Accountant",
    permissions: [
      "expense.read",
      "expense.create",
      "expense.update",
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

  describe("1. Validation & Schema Constraints", () => {
    it("rejects direct business expense paid immediately without bank account", () => {
      const invalidInput = {
        expenseType: "DIRECT_BUSINESS",
        paymentType: "PAID_IMMEDIATELY",
        expenseDate: "2026-09-25",
        description: "Office supplies",
        lines: [
          {
            description: "Printer paper",
            quantity: 2,
            unitPrice: 25,
          },
        ],
      };

      const result = CreateExpenseSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Bank account is required");
      }
    });

    it("rejects negative quantity or price in expense line item", () => {
      const invalidInput = {
        expenseType: "EMPLOYEE_CLAIM",
        expenseDate: "2026-09-25",
        description: "Travel expenses",
        lines: [
          {
            description: "Taxi",
            quantity: -1,
            unitPrice: 50,
          },
        ],
      };

      const result = CreateExpenseSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("accepts valid employee claim payload", () => {
      const validInput = {
        expenseType: "EMPLOYEE_CLAIM",
        claimantId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        expenseDate: "2026-09-25",
        description: "Conference meals and lodging",
        lines: [
          {
            description: "Hotel stay",
            quantity: 2,
            unitPrice: 120,
            taxRate: 10,
          },
        ],
      };

      const result = CreateExpenseSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe("2. Anti-Self-Approval Enforcement", () => {
    it("strictly blocks a claimant from approving their own claim even if they hold approval permission", async () => {
      const claimantWithApprovalPerm: SessionUser = {
        ...claimantUser,
        permissions: [...claimantUser.permissions, "expense.approve"],
      };

      (db.expense.findFirst as any).mockResolvedValue({
        id: "exp_101",
        organizationId: "org_alpha",
        expenseNumber: "EXP-2026-00001",
        expenseType: "EMPLOYEE_CLAIM",
        status: "SUBMITTED",
        claimantId: claimantWithApprovalPerm.id, // User is claimant
        createdById: claimantWithApprovalPerm.id,
        total: 240,
      });

      await expect(
        ExpenseApprovalService.approve(claimantWithApprovalPerm, "exp_101")
      ).rejects.toThrow("Claimants are strictly prohibited from approving their own expense claims.");
    });

    it("allows a manager to approve an expense submitted by a different employee", async () => {
      (db.expense.findFirst as any).mockResolvedValue({
        id: "exp_101",
        organizationId: "org_alpha",
        expenseNumber: "EXP-2026-00001",
        expenseType: "EMPLOYEE_CLAIM",
        status: "SUBMITTED",
        claimantId: claimantUser.id,
        createdById: claimantUser.id,
        total: 240,
      });

      (db.expense.update as any).mockResolvedValue({
        id: "exp_101",
        status: "APPROVED",
        approvedById: managerUser.id,
      });

      const approved = await ExpenseApprovalService.approve(managerUser, "exp_101");
      expect(approved.status).toBe("APPROVED");
      expect(db.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "exp_101" },
          data: expect.objectContaining({
            status: "APPROVED",
            approvedById: managerUser.id,
          }),
        })
      );
    });
  });

  describe("3. Lifecycle State Transition Rules", () => {
    it("prevents approving an expense that is still in DRAFT status", async () => {
      (db.expense.findFirst as any).mockResolvedValue({
        id: "exp_draft",
        organizationId: "org_alpha",
        expenseNumber: "EXP-2026-00002",
        expenseType: "EMPLOYEE_CLAIM",
        status: "DRAFT", // Must be SUBMITTED
        claimantId: claimantUser.id,
      });

      await expect(
        ExpenseApprovalService.approve(managerUser, "exp_draft")
      ).rejects.toThrow(ValidationError);
    });

    it("prevents rejecting an already PAID or POSTED expense", async () => {
      (db.expense.findFirst as any).mockResolvedValue({
        id: "exp_posted",
        organizationId: "org_alpha",
        expenseNumber: "EXP-2026-00003",
        status: "POSTED",
        claimantId: claimantUser.id,
      });

      await expect(
        ExpenseApprovalService.reject(managerUser, "exp_posted", {
          reason: "Too high",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("4. Tenant Isolation & Permissions", () => {
    it("blocks an accountant from Org Beta from accessing or paying an expense from Org Alpha", async () => {
      const foreignUser: SessionUser = {
        ...accountantUser,
        activeOrganizationId: "org_beta",
      };

      (db.bankAccount.findFirst as any).mockResolvedValue(null);

      await expect(
        ExpensePaymentService.payExpense(foreignUser, "exp_101", {
          bankAccountId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("blocks a standard member without expense.manage from voiding an expense", async () => {
      await expect(
        ExpensePaymentService.voidExpense(claimantUser, "exp_101", "Mistake")
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("5. Voiding & Reversal Integrity", () => {
    it("voiding an unposted DRAFT expense does not create accounting reversals", async () => {
      (db.expense.findFirst as any).mockResolvedValue({
        id: "exp_unposted",
        organizationId: "org_alpha",
        expenseNumber: "EXP-2026-00005",
        status: "DRAFT",
        journalEntryId: null,
        reimbursementJournalId: null,
      });

      (db.expense.update as any).mockResolvedValue({
        id: "exp_unposted",
        status: "VOIDED",
      });

      const voided = await ExpensePaymentService.voidExpense(accountantUser, "exp_unposted", "Duplicate");
      expect(voided.status).toBe("VOIDED");
      expect(db.journalEntry.create).not.toHaveBeenCalled();
    });

    it("throws ConflictError if attempting to void an already VOIDED expense", async () => {
      (db.expense.findFirst as any).mockResolvedValue({
        id: "exp_already_voided",
        organizationId: "org_alpha",
        expenseNumber: "EXP-2026-00006",
        status: "VOIDED",
      });

      await expect(
        ExpensePaymentService.voidExpense(accountantUser, "exp_already_voided", "Redo")
      ).rejects.toThrow(ConflictError);
    });
  });
});
