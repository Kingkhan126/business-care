import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getExpenses, POST as createExpense } from "@/app/api/expenses/route";
import { GET as getExpense, PATCH as updateExpense } from "@/app/api/expenses/[id]/route";
import { POST as submitExpense } from "@/app/api/expenses/[id]/submit/route";
import { POST as approveExpense } from "@/app/api/expenses/[id]/approve/route";
import { POST as rejectExpense } from "@/app/api/expenses/[id]/reject/route";
import { POST as postExpense } from "@/app/api/expenses/[id]/post/route";
import { POST as payExpense } from "@/app/api/expenses/[id]/pay/route";
import { POST as voidExpense } from "@/app/api/expenses/[id]/void/route";
import { GET as getCategories, POST as createCategory } from "@/app/api/expenses/categories/route";
import { GET as getCategory, PATCH as updateCategory, DELETE as deleteCategory } from "@/app/api/expenses/categories/[id]/route";
import { GET as getReports } from "@/app/api/expenses/reports/route";
import { SessionUser } from "@/types/auth";

let mockCurrentUser: SessionUser | null = null;

vi.mock("@/lib/auth/session", () => ({
  getCurrentSessionUser: vi.fn(async () => mockCurrentUser),
}));

vi.mock("@/server/services/ExpenseService", () => ({
  ExpenseService: {
    listExpenses: vi.fn().mockResolvedValue({ items: [{ id: "exp_1", expenseNumber: "EXP-2026-00001" }], total: 1 }),
    getExpenseById: vi.fn().mockResolvedValue({ id: "exp_1", expenseNumber: "EXP-2026-00001", total: 100 }),
    createExpense: vi.fn().mockResolvedValue({ id: "exp_new", expenseNumber: "EXP-2026-00002", total: 250 }),
    updateExpense: vi.fn().mockResolvedValue({ id: "exp_1", description: "Updated description" }),
    submitExpense: vi.fn().mockResolvedValue({ id: "exp_1", status: "SUBMITTED" }),
    getExpenseReports: vi.fn().mockResolvedValue({ summary: { total: 5000, count: 25 } }),
  },
}));

vi.mock("@/server/services/ExpenseApprovalService", () => ({
  ExpenseApprovalService: {
    approve: vi.fn().mockResolvedValue({ id: "exp_1", status: "APPROVED" }),
    reject: vi.fn().mockResolvedValue({ id: "exp_1", status: "REJECTED", rejectionReason: "Exceeds per diem limit" }),
  },
}));

vi.mock("@/server/services/ExpensePostingService", () => ({
  ExpensePostingService: {
    postExpense: vi.fn().mockResolvedValue({ id: "je_1", journalNumber: "JE-000001", status: "POSTED" }),
  },
}));

vi.mock("@/server/services/ExpensePaymentService", () => ({
  ExpensePaymentService: {
    payExpense: vi.fn().mockResolvedValue({ id: "exp_1", status: "PAID", paidAt: new Date() }),
    voidExpense: vi.fn().mockResolvedValue({ id: "exp_1", status: "VOIDED" }),
  },
}));

vi.mock("@/server/services/ExpenseCategoryService", () => ({
  ExpenseCategoryService: {
    listCategories: vi.fn().mockResolvedValue([{ id: "cat_1", code: "TRAVEL", name: "Travel" }]),
    getCategoryById: vi.fn().mockResolvedValue({ id: "cat_1", code: "TRAVEL", name: "Travel" }),
    createCategory: vi.fn().mockResolvedValue({ id: "cat_2", code: "MEALS", name: "Meals & Entertainment" }),
    updateCategory: vi.fn().mockResolvedValue({ id: "cat_1", name: "Updated Travel" }),
    deactivateCategory: vi.fn().mockResolvedValue({ id: "cat_1", isActive: false }),
  },
}));

describe("Phase 7: Expense API Route Handlers Suite", () => {
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
    mockCurrentUser = adminUser;
  });

  describe("1. CRUD & Pagination Endpoints", () => {
    it("GET /api/expenses returns paginated list of expenses", async () => {
      const req = new Request("http://localhost:3000/api/expenses?skip=0&take=10&search=EXP");
      const res = await getExpenses(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.total).toBe(1);
      expect(json.items[0].expenseNumber).toBe("EXP-2026-00001");
    });

    it("POST /api/expenses creates a new expense and returns 201", async () => {
      const payload = {
        expenseType: "DIRECT_BUSINESS",
        paymentType: "PAID_IMMEDIATELY",
        expenseDate: "2026-09-25",
        description: "Office Monitors",
        bankAccountId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        lines: [
          {
            description: "Dell 27-inch 4K Monitor",
            quantity: 1,
            unitPrice: 250,
          },
        ],
      };

      const req = new Request("http://localhost:3000/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await createExpense(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.id).toBe("exp_new");
    });

    it("GET /api/expenses/[id] retrieves specific expense by ID", async () => {
      const req = new Request("http://localhost:3000/api/expenses/exp_1");
      const res = await getExpense(req, { params: { id: "exp_1" } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe("exp_1");
    });

    it("PATCH /api/expenses/[id] updates draft expense description", async () => {
      const payload = { description: "Updated description" };
      const req = new Request("http://localhost:3000/api/expenses/exp_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await updateExpense(req, { params: { id: "exp_1" } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.description).toBe("Updated description");
    });
  });

  describe("2. Workflow Action Endpoints", () => {
    it("POST /api/expenses/[id]/submit triggers expense submission", async () => {
      const req = new Request("http://localhost:3000/api/expenses/exp_1/submit", { method: "POST" });
      const res = await submitExpense(req, { params: { id: "exp_1" } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("SUBMITTED");
    });

    it("POST /api/expenses/[id]/approve approves the expense", async () => {
      const req = new Request("http://localhost:3000/api/expenses/exp_1/approve", { method: "POST" });
      const res = await approveExpense(req, { params: { id: "exp_1" } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("APPROVED");
    });

    it("POST /api/expenses/[id]/reject rejects the expense with a reason", async () => {
      const req = new Request("http://localhost:3000/api/expenses/exp_1/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Exceeds per diem limit" }),
      });
      const res = await rejectExpense(req, { params: { id: "exp_1" } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("REJECTED");
    });

    it("POST /api/expenses/[id]/post posts expense to General Ledger", async () => {
      const req = new Request("http://localhost:3000/api/expenses/exp_1/post", { method: "POST" });
      const res = await postExpense(req, { params: { id: "exp_1" } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.journalNumber).toBe("JE-000001");
    });

    it("POST /api/expenses/[id]/pay executes reimbursement / payment", async () => {
      const req = new Request("http://localhost:3000/api/expenses/exp_1/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
          paymentDate: "2026-09-25",
        }),
      });
      const res = await payExpense(req, { params: { id: "exp_1" } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("PAID");
    });

    it("POST /api/expenses/[id]/void voids expense and reverses journals", async () => {
      const req = new Request("http://localhost:3000/api/expenses/exp_1/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Billing mistake" }),
      });
      const res = await voidExpense(req, { params: { id: "exp_1" } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("VOIDED");
    });
  });

  describe("3. Categories & Reports Endpoints", () => {
    it("GET /api/expenses/categories lists categories", async () => {
      const req = new Request("http://localhost:3000/api/expenses/categories");
      const res = await getCategories(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.length).toBe(1);
      expect(json[0].code).toBe("TRAVEL");
    });

    it("POST /api/expenses/categories creates category", async () => {
      const req = new Request("http://localhost:3000/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Meals & Entertainment", code: "MEALS" }),
      });
      const res = await createCategory(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.code).toBe("MEALS");
    });

    it("GET /api/expenses/reports returns authoritative server-side aggregates", async () => {
      const req = new Request("http://localhost:3000/api/expenses/reports?startDate=2026-01-01&endDate=2026-12-31");
      const res = await getReports(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.summary.total).toBe(5000);
    });
  });
});
