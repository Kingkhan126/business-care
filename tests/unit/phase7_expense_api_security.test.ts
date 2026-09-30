import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getExpense, PATCH as updateExpense } from "@/app/api/expenses/[id]/route";
import { POST as createExpense } from "@/app/api/expenses/route";
import { POST as submitExpense } from "@/app/api/expenses/[id]/submit/route";
import { POST as approveExpense } from "@/app/api/expenses/[id]/approve/route";
import { POST as rejectExpense } from "@/app/api/expenses/[id]/reject/route";
import { POST as postExpense } from "@/app/api/expenses/[id]/post/route";
import { POST as payExpense } from "@/app/api/expenses/[id]/pay/route";
import { POST as voidExpense } from "@/app/api/expenses/[id]/void/route";
import { POST as uploadAttachment } from "@/app/api/expenses/[id]/attachments/route";
import { PATCH as updateCategory } from "@/app/api/expenses/categories/[id]/route";
import { SessionUser } from "@/types/auth";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { ExpenseService } from "@/server/services/ExpenseService";
import { ExpenseApprovalService } from "@/server/services/ExpenseApprovalService";
import { ExpensePostingService } from "@/server/services/ExpensePostingService";
import { ExpensePaymentService } from "@/server/services/ExpensePaymentService";
import { ExpenseCategoryService } from "@/server/services/ExpenseCategoryService";
import { storageService } from "@/lib/storage";

let mockUser: SessionUser | null = null;

vi.mock("@/lib/auth/session", () => ({
  getCurrentSessionUser: vi.fn(async () => mockUser),
}));

vi.mock("@/server/services/ExpenseService", () => ({
  ExpenseService: {
    createExpense: vi.fn(),
    getExpenseById: vi.fn(),
    updateExpense: vi.fn(),
    submitExpense: vi.fn(),
    addAttachment: vi.fn(),
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
    updateCategory: vi.fn(),
  },
}));

describe("Phase 7: Expense API Security, IDOR & Mass-Assignment Suite", () => {
  const userOrgAlpha: SessionUser = {
    id: "usr_alpha",
    email: "user@alpha.com",
    name: "Alpha User",
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
    mockUser = userOrgAlpha;
  });

  describe("1. IDOR Prevention (Cross-Tenant Isolation)", () => {
    it("fails with 404 when Org Alpha user attempts to GET an expense belonging to Org Beta", async () => {
      (ExpenseService.getExpenseById as any).mockRejectedValue(
        new NotFoundError("Expense not found")
      );

      const req = new Request("http://localhost:3000/api/expenses/exp_org_beta");
      const res = await getExpense(req, { params: { id: "exp_org_beta" } });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Expense not found");
    });

    it("fails with 404 when Org Alpha user attempts to PATCH an expense from Org Beta", async () => {
      (ExpenseService.updateExpense as any).mockRejectedValue(
        new NotFoundError("Expense not found")
      );

      const req = new Request("http://localhost:3000/api/expenses/exp_org_beta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Hacked" }),
      });
      const res = await updateExpense(req, { params: { id: "exp_org_beta" } });

      expect(res.status).toBe(404);
    });

    it("fails with 404 when Org Alpha user attempts to SUBMIT an expense from Org Beta", async () => {
      (ExpenseService.submitExpense as any).mockRejectedValue(
        new NotFoundError("Expense not found")
      );

      const req = new Request("http://localhost:3000/api/expenses/exp_org_beta/submit", { method: "POST" });
      const res = await submitExpense(req, { params: { id: "exp_org_beta" } });
      expect(res.status).toBe(404);
    });

    it("fails with 404 when Org Alpha user attempts to APPROVE an expense from Org Beta", async () => {
      (ExpenseApprovalService.approve as any).mockRejectedValue(
        new NotFoundError("Expense not found")
      );

      const req = new Request("http://localhost:3000/api/expenses/exp_org_beta/approve", { method: "POST" });
      const res = await approveExpense(req, { params: { id: "exp_org_beta" } });
      expect(res.status).toBe(404);
    });

    it("fails with 404 when Org Alpha user attempts to POST an expense from Org Beta to GL", async () => {
      (ExpensePostingService.postExpense as any).mockRejectedValue(
        new NotFoundError("Expense not found")
      );

      const req = new Request("http://localhost:3000/api/expenses/exp_org_beta/post", { method: "POST" });
      const res = await postExpense(req, { params: { id: "exp_org_beta" } });
      expect(res.status).toBe(404);
    });

    it("fails with 404 when Org Alpha user attempts to PAY an expense from Org Beta", async () => {
      (ExpensePaymentService.payExpense as any).mockRejectedValue(
        new NotFoundError("Expense not found")
      );

      const req = new Request("http://localhost:3000/api/expenses/exp_org_beta/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId: "clxxxxxxxxxxxxxxxxxxxxxxxxx" }),
      });
      const res = await payExpense(req, { params: { id: "exp_org_beta" } });
      expect(res.status).toBe(404);
    });

    it("fails with 404 when Org Alpha user attempts to VOID an expense from Org Beta", async () => {
      (ExpensePaymentService.voidExpense as any).mockRejectedValue(
        new NotFoundError("Expense not found")
      );

      const req = new Request("http://localhost:3000/api/expenses/exp_org_beta/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Attacking Org Beta" }),
      });
      const res = await voidExpense(req, { params: { id: "exp_org_beta" } });
      expect(res.status).toBe(404);
    });

    it("fails with 404 when Org Alpha user attempts to update a category from Org Beta", async () => {
      (ExpenseCategoryService.updateCategory as any).mockRejectedValue(
        new NotFoundError("Expense Category not found")
      );

      const req = new Request("http://localhost:3000/api/expenses/categories/cat_org_beta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      });
      const res = await updateCategory(req, { params: { id: "cat_org_beta" } });
      expect(res.status).toBe(404);
    });
  });

  describe("2. Mass-Assignment & Forged Field Defenses", () => {
    it("strips authoritative system fields during POST /api/expenses", async () => {
      (ExpenseService.createExpense as any).mockImplementation((_user: any, input: any) => ({
        id: "exp_safe",
        ...input,
        status: "DRAFT", // Server-controlled
      }));

      const maliciousPayload = {
        organizationId: "org_injected",
        status: "POSTED",
        journalEntryId: "je_forged",
        reimbursementJournalId: "reimb_forged",
        approvedById: "usr_forged",
        postedAt: "2026-01-01T00:00:00Z",
        paidAt: "2026-01-01T00:00:00Z",
        createdById: "usr_forged",
        expenseType: "DIRECT_BUSINESS",
        paymentType: "PAID_IMMEDIATELY",
        expenseDate: "2026-09-25",
        description: "Valid Description",
        bankAccountId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        lines: [
          {
            description: "Printer Toner",
            quantity: 1,
            unitPrice: 80,
          },
        ],
      };

      const req = new Request("http://localhost:3000/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(maliciousPayload),
      });

      const res = await createExpense(req);
      expect(res.status).toBe(201);

      // Verify that ExpenseService was called WITHOUT the stripped fields
      const passedInput = (ExpenseService.createExpense as any).mock.calls[0][1];
      expect(passedInput.organizationId).toBeUndefined();
      expect(passedInput.status).toBeUndefined();
      expect(passedInput.journalEntryId).toBeUndefined();
      expect(passedInput.reimbursementJournalId).toBeUndefined();
      expect(passedInput.approvedById).toBeUndefined();
      expect(passedInput.postedAt).toBeUndefined();
      expect(passedInput.paidAt).toBeUndefined();
      expect(passedInput.createdById).toBeUndefined();
    });

    it("strips financial document totals and system fields during PATCH /api/expenses/[id]", async () => {
      (ExpenseService.updateExpense as any).mockResolvedValue({ id: "exp_1" });

      const maliciousPayload = {
        total: 0.01, // Client trying to forge document total
        subtotal: 0.01,
        taxTotal: 0,
        status: "PAID",
        description: "Legitimate description update",
      };

      const req = new Request("http://localhost:3000/api/expenses/exp_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(maliciousPayload),
      });

      const res = await updateExpense(req, { params: { id: "exp_1" } });
      expect(res.status).toBe(200);

      const passedInput = (ExpenseService.updateExpense as any).mock.calls[0][2];
      expect(passedInput.total).toBeUndefined();
      expect(passedInput.subtotal).toBeUndefined();
      expect(passedInput.status).toBeUndefined();
      expect(passedInput.description).toBe("Legitimate description update");
    });
  });

  describe("3. Attachment Upload Security", () => {
    it("rejects upload when no file is attached", async () => {
      const formData = new FormData();
      const req = new Request("http://localhost:3000/api/expenses/exp_1/attachments", {
        method: "POST",
        body: formData,
      });

      const res = await uploadAttachment(req, { params: { id: "exp_1" } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("No file was uploaded");
    });

    it("storageService strictly validates magic bytes and rejects SVG and executable uploads", async () => {
      // 1. SVG content rejection
      const svgBuffer = Buffer.from("<svg onload='alert(1)'></svg>");
      await expect(
        storageService.uploadExpenseAttachment("org_alpha", "exp_1", {
          buffer: svgBuffer,
          filename: "receipt.svg",
          mimeType: "image/svg+xml",
          sizeBytes: svgBuffer.length,
        })
      ).rejects.toThrow(ValidationError);

      // 2. Executable extension rejection
      const exeBuffer = Buffer.from("MZ\x90\x00\x03\x00\x00\x00");
      await expect(
        storageService.uploadExpenseAttachment("org_alpha", "exp_1", {
          buffer: exeBuffer,
          filename: "invoice.exe",
          mimeType: "application/octet-stream",
          sizeBytes: exeBuffer.length,
        })
      ).rejects.toThrow(ValidationError);

      // 3. Fake PDF mime with corrupted header
      const fakePdfBuffer = Buffer.from("NOT_A_REAL_PDF_HEADER");
      await expect(
        storageService.uploadExpenseAttachment("org_alpha", "exp_1", {
          buffer: fakePdfBuffer,
          filename: "receipt.pdf",
          mimeType: "application/pdf",
          sizeBytes: fakePdfBuffer.length,
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});
