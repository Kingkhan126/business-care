import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getExpenses, POST as createExpense } from "@/app/api/expenses/route";
import { GET as getExpense, PATCH as updateExpense } from "@/app/api/expenses/[id]/route";
import { POST as submitExpense } from "@/app/api/expenses/[id]/submit/route";
import { POST as approveExpense } from "@/app/api/expenses/[id]/approve/route";
import { POST as rejectExpense } from "@/app/api/expenses/[id]/reject/route";
import { POST as postExpense } from "@/app/api/expenses/[id]/post/route";
import { POST as payExpense } from "@/app/api/expenses/[id]/pay/route";
import { POST as voidExpense } from "@/app/api/expenses/[id]/void/route";
import { GET as getReports } from "@/app/api/expenses/reports/route";
import { GET as getAttachments } from "@/app/api/expenses/[id]/attachments/route";
import { POST as createCategory } from "@/app/api/expenses/categories/route";
import { SessionUser } from "@/types/auth";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { ExpenseService } from "@/server/services/ExpenseService";
import { ExpenseApprovalService } from "@/server/services/ExpenseApprovalService";
import { ExpensePostingService } from "@/server/services/ExpensePostingService";
import { ExpensePaymentService } from "@/server/services/ExpensePaymentService";
import { ExpenseCategoryService } from "@/server/services/ExpenseCategoryService";

let mockUser: SessionUser | null = null;

vi.mock("@/lib/auth/session", () => ({
  getCurrentSessionUser: vi.fn(async () => mockUser),
}));

vi.mock("@/server/services/ExpenseService", () => ({
  ExpenseService: {
    listExpenses: vi.fn(),
    getExpenseById: vi.fn(),
    createExpense: vi.fn(),
    updateExpense: vi.fn(),
    submitExpense: vi.fn(),
    listAttachments: vi.fn(),
    getExpenseReports: vi.fn(),
  },
}));

vi.mock("@/server/services/ExpenseApprovalService", () => ({
  ExpenseApprovalService: {
    approve: vi.fn(),
    reject: vi.fn(),
  },
}));

vi.mock("@/server/services/ExpensePostingService", () => ({
  ExpensePostingService: {
    postExpense: vi.fn(),
  },
}));

vi.mock("@/server/services/ExpensePaymentService", () => ({
  ExpensePaymentService: {
    payExpense: vi.fn(),
    voidExpense: vi.fn(),
  },
}));

vi.mock("@/server/services/ExpenseCategoryService", () => ({
  ExpenseCategoryService: {
    createCategory: vi.fn(),
  },
}));

describe("Phase 7: Expense API Authentication & Granular RBAC Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Unauthenticated Access Protection", () => {
    beforeEach(() => {
      mockUser = null; // Unauthenticated
    });

    it("returns 401 Unauthorized for GET /api/expenses", async () => {
      const res = await getExpenses(new Request("http://localhost:3000/api/expenses"));
      expect(res.status).toBe(401);
    });

    it("returns 401 Unauthorized for POST /api/expenses", async () => {
      const res = await createExpense(new Request("http://localhost:3000/api/expenses", { method: "POST" }));
      expect(res.status).toBe(401);
    });

    it("returns 401 Unauthorized for POST /api/expenses/[id]/approve", async () => {
      const res = await approveExpense(new Request("http://localhost:3000/api/expenses/exp_1/approve", { method: "POST" }), {
        params: { id: "exp_1" },
      });
      expect(res.status).toBe(401);
    });
  });

  describe("2. Canonical Phase 7 RBAC Enforcement", () => {
    const baseUser: SessionUser = {
      id: "usr_limited",
      email: "limited@acme.com",
      name: "Limited User",
      activeOrganizationId: "org_alpha",
      roleName: "Member",
      permissions: [],
    };

    it("blocks GET /api/expenses without expense.read permission", async () => {
      mockUser = { ...baseUser, permissions: [] };
      (ExpenseService.listExpenses as any).mockRejectedValue(
        new ForbiddenError("Permission denied: expense.read required")
      );

      const res = await getExpenses(new Request("http://localhost:3000/api/expenses"));
      expect(res.status).toBe(403);
    });

    it("blocks POST /api/expenses without expense.create permission", async () => {
      mockUser = { ...baseUser, permissions: ["expense.read"] };
      (ExpenseService.createExpense as any).mockRejectedValue(
        new ForbiddenError("Permission denied: expense.create required")
      );

      const payload = {
        expenseType: "DIRECT_BUSINESS",
        paymentType: "PAID_IMMEDIATELY",
        expenseDate: "2026-09-25",
        description: "Coffee",
        bankAccountId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        lines: [{ description: "Coffee beans", quantity: 1, unitPrice: 20 }],
      };

      const res = await createExpense(
        new Request("http://localhost:3000/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
      expect(res.status).toBe(403);
    });

    it("blocks POST /api/expenses/[id]/submit without expense.submit permission", async () => {
      mockUser = { ...baseUser, permissions: ["expense.read"] };
      (ExpenseService.submitExpense as any).mockRejectedValue(
        new ForbiddenError("Permission denied: expense.submit required")
      );

      const res = await submitExpense(
        new Request("http://localhost:3000/api/expenses/exp_1/submit", { method: "POST" }),
        { params: { id: "exp_1" } }
      );
      expect(res.status).toBe(403);
    });

    it("blocks POST /api/expenses/[id]/approve without expense.approve permission", async () => {
      mockUser = { ...baseUser, permissions: ["expense.read", "expense.submit"] };
      (ExpenseApprovalService.approve as any).mockRejectedValue(
        new ForbiddenError("Permission denied: expense.approve required")
      );

      const res = await approveExpense(
        new Request("http://localhost:3000/api/expenses/exp_1/approve", { method: "POST" }),
        { params: { id: "exp_1" } }
      );
      expect(res.status).toBe(403);
    });

    it("blocks claimant from self-approving their own claim even with expense.approve permission", async () => {
      mockUser = { ...baseUser, permissions: ["expense.approve"] };
      (ExpenseApprovalService.approve as any).mockRejectedValue(
        new ValidationError("Claimants are strictly prohibited from approving their own expense claims.")
      );

      const res = await approveExpense(
        new Request("http://localhost:3000/api/expenses/exp_1/approve", { method: "POST" }),
        { params: { id: "exp_1" } }
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("prohibited from approving their own expense claims");
    });

    it("blocks POST /api/expenses/[id]/post without expense.post permission", async () => {
      mockUser = { ...baseUser, permissions: ["expense.read", "expense.approve"] };
      (ExpensePostingService.postExpense as any).mockRejectedValue(
        new ForbiddenError("Permission denied: expense.post required")
      );

      const res = await postExpense(
        new Request("http://localhost:3000/api/expenses/exp_1/post", { method: "POST" }),
        { params: { id: "exp_1" } }
      );
      expect(res.status).toBe(403);
    });

    it("blocks POST /api/expenses/[id]/pay without expense.pay permission", async () => {
      mockUser = { ...baseUser, permissions: ["expense.read", "expense.post"] };
      (ExpensePaymentService.payExpense as any).mockRejectedValue(
        new ForbiddenError("Permission denied: expense.pay required")
      );

      const res = await payExpense(
        new Request("http://localhost:3000/api/expenses/exp_1/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bankAccountId: "clxxxxxxxxxxxxxxxxxxxxxxxxx" }),
        }),
        { params: { id: "exp_1" } }
      );
      expect(res.status).toBe(403);
    });

    it("blocks POST /api/expenses/[id]/void without expense.manage permission", async () => {
      mockUser = { ...baseUser, permissions: ["expense.read", "expense.post", "expense.pay"] };
      (ExpensePaymentService.voidExpense as any).mockRejectedValue(
        new ForbiddenError("Permission denied: expense.manage required")
      );

      const res = await voidExpense(
        new Request("http://localhost:3000/api/expenses/exp_1/void", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Void" }),
        }),
        { params: { id: "exp_1" } }
      );
      expect(res.status).toBe(403);
    });

    it("blocks GET /api/expenses/reports without expense.reports permission", async () => {
      mockUser = { ...baseUser, permissions: ["expense.read"] };
      (ExpenseService.getExpenseReports as any).mockRejectedValue(
        new ForbiddenError("Permission denied: expense.reports required")
      );

      const res = await getReports(new Request("http://localhost:3000/api/expenses/reports"));
      expect(res.status).toBe(403);
    });

    it("ensures legacy 'expenses.create' permission does not bypass Phase 7 canonical permission", async () => {
      // User has legacy Phase 4 permission "expenses.create", but lacks Phase 7 "expense.create"
      mockUser = { ...baseUser, permissions: ["expenses.create"] };
      (ExpenseService.createExpense as any).mockRejectedValue(
        new ForbiddenError("Permission denied: expense.create required")
      );

      const payload = {
        expenseType: "DIRECT_BUSINESS",
        paymentType: "PAID_IMMEDIATELY",
        expenseDate: "2026-09-25",
        description: "Bypass attempt",
        bankAccountId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        lines: [{ description: "Item", quantity: 1, unitPrice: 50 }],
      };

      const res = await createExpense(
        new Request("http://localhost:3000/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
      expect(res.status).toBe(403);
    });
  });
});
