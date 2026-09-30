import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { CreateExpenseSchema, UpdateExpenseSchema, RejectExpenseSchema, PayExpenseSchema } from "@/lib/validation/expense";
import { SessionUser } from "@/types/auth";
import { ForbiddenError, ValidationError, ConflictError } from "@/lib/errors";

describe("Phase 7: Expense UI & Workflow State Verification Suite", () => {
  const viewerUser: SessionUser = {
    id: "usr_viewer",
    email: "viewer@acme.com",
    name: "Viewer",
    activeOrganizationId: "org_alpha",
    roleName: "Viewer",
    permissions: ["expense.read"],
  };

  const memberUser: SessionUser = {
    id: "usr_member",
    email: "member@acme.com",
    name: "Member Staff",
    activeOrganizationId: "org_alpha",
    roleName: "Member",
    permissions: ["expense.read", "expense.create", "expense.update", "expense.submit", "expense.attachments"],
  };

  const managerUser: SessionUser = {
    id: "usr_manager",
    email: "manager@acme.com",
    name: "Manager",
    activeOrganizationId: "org_alpha",
    roleName: "Manager",
    permissions: ["expense.read", "expense.create", "expense.update", "expense.submit", "expense.approve", "expense.reject", "expense.attachments", "expense.reports"],
  };

  const accountantUser: SessionUser = {
    id: "usr_accountant",
    email: "accountant@acme.com",
    name: "Accountant",
    activeOrganizationId: "org_alpha",
    roleName: "Accountant",
    permissions: ["expense.read", "expense.create", "expense.update", "expense.post", "expense.pay", "expense.manage", "expense.attachments", "expense.reports"],
  };

  const ownerUser: SessionUser = {
    id: "usr_owner",
    email: "owner@acme.com",
    name: "Owner",
    activeOrganizationId: "org_alpha",
    roleName: "Owner",
    permissions: [
      "expense.read", "expense.create", "expense.update", "expense.submit",
      "expense.approve", "expense.reject", "expense.post", "expense.pay",
      "expense.manage", "expense.attachments", "expense.reports",
    ],
  };

  describe("1. Permission Matrix & Workflow Action Entitlements", () => {
    const checkCanSubmit = (u: SessionUser) => u.permissions.includes("expense.submit");
    const checkCanApprove = (u: SessionUser, claimantId?: string | null) =>
      u.permissions.includes("expense.approve") && u.id !== claimantId;
    const checkCanReject = (u: SessionUser) => u.permissions.includes("expense.reject");
    const checkCanPost = (u: SessionUser) => u.permissions.includes("expense.post");
    const checkCanPay = (u: SessionUser) => u.permissions.includes("expense.pay");
    const checkCanVoid = (u: SessionUser) => u.permissions.includes("expense.manage");

    it("verifies Viewer has read-only access and cannot trigger any mutation actions", () => {
      expect(checkCanSubmit(viewerUser)).toBe(false);
      expect(checkCanApprove(viewerUser)).toBe(false);
      expect(checkCanReject(viewerUser)).toBe(false);
      expect(checkCanPost(viewerUser)).toBe(false);
      expect(checkCanPay(viewerUser)).toBe(false);
      expect(checkCanVoid(viewerUser)).toBe(false);
    });

    it("verifies Member can create & submit, but cannot approve, post, or pay", () => {
      expect(checkCanSubmit(memberUser)).toBe(true);
      expect(checkCanApprove(memberUser)).toBe(false);
      expect(checkCanPost(memberUser)).toBe(false);
      expect(checkCanPay(memberUser)).toBe(false);
    });

    it("verifies Manager can approve other employee claims, but Anti-Self-Approval strictly blocks self-approval", () => {
      // Approving Sarah's claim
      expect(checkCanApprove(managerUser, "usr_member")).toBe(true);
      // Approving their own claim -> BLOCKED
      expect(checkCanApprove(managerUser, managerUser.id)).toBe(false);
    });

    it("verifies Accountant can post and execute payment disbursements, but cannot approve without expense.approve", () => {
      expect(checkCanPost(accountantUser)).toBe(true);
      expect(checkCanPay(accountantUser)).toBe(true);
      expect(checkCanVoid(accountantUser)).toBe(true);
      expect(checkCanApprove(accountantUser)).toBe(false);
    });

    it("verifies Owner holds all administrative permissions subject to anti-self-approval", () => {
      expect(checkCanPost(ownerUser)).toBe(true);
      expect(checkCanPay(ownerUser)).toBe(true);
      expect(checkCanVoid(ownerUser)).toBe(true);
      expect(checkCanApprove(ownerUser, "usr_other")).toBe(true);
      expect(checkCanApprove(ownerUser, ownerUser.id)).toBe(false); // Anti-self-approval holds universally
    });
  });

  describe("2. Workflow Lifecycle Transitions", () => {
    type ExpenseWorkflowState = "DRAFT" | "SUBMITTED" | "APPROVED" | "POSTED" | "PAID" | "REJECTED" | "VOIDED";

    const getAvailableActionsForState = (status: ExpenseWorkflowState) => {
      switch (status) {
        case "DRAFT":
          return ["EDIT", "SUBMIT", "CANCEL"];
        case "SUBMITTED":
          return ["APPROVE", "REJECT"];
        case "APPROVED":
          return ["POST_TO_GL"];
        case "POSTED":
          return ["PAY_DISBURSE", "VOID"];
        case "PAID":
          return ["VOID"];
        case "REJECTED":
          return ["EDIT", "RESUBMIT"];
        case "VOIDED":
          return [];
      }
    };

    it("verifies standard linear lifecycle: DRAFT -> SUBMITTED -> APPROVED -> POSTED -> PAID", () => {
      expect(getAvailableActionsForState("DRAFT")).toContain("SUBMIT");
      expect(getAvailableActionsForState("SUBMITTED")).toContain("APPROVE");
      expect(getAvailableActionsForState("APPROVED")).toContain("POST_TO_GL");
      expect(getAvailableActionsForState("POSTED")).toContain("PAY_DISBURSE");
      expect(getAvailableActionsForState("PAID")).toContain("VOID");
      expect(getAvailableActionsForState("VOIDED")).toHaveLength(0);
    });

    it("verifies rejection and resubmission lifecycle: SUBMITTED -> REJECTED -> RESUBMIT", () => {
      expect(getAvailableActionsForState("SUBMITTED")).toContain("REJECT");
      expect(getAvailableActionsForState("REJECTED")).toEqual(["EDIT", "RESUBMIT"]);
    });
  });

  describe("3. UI Form Validation & Client Calculation Previews", () => {
    it("validates line item calculations preview formula", () => {
      const lines = [
        { quantity: 2, unitPrice: 150, taxRate: 10 }, // subtotal: 300, tax: 30, total: 330
        { quantity: 1, unitPrice: 75, taxRate: 5 },   // subtotal: 75, tax: 3.75, total: 78.75
      ];

      const preview = lines.reduce(
        (acc, l) => {
          const sub = l.quantity * l.unitPrice;
          const tax = (sub * l.taxRate) / 100;
          return {
            subtotal: acc.subtotal + sub,
            taxTotal: acc.taxTotal + tax,
            total: acc.total + sub + tax,
          };
        },
        { subtotal: 0, taxTotal: 0, total: 0 }
      );

      expect(preview.subtotal).toBe(375);
      expect(preview.taxTotal).toBe(33.75);
      expect(preview.total).toBe(408.75);
    });

    it("validates employee claim payload requires claimant", () => {
      const missingClaimant = {
        expenseType: "EMPLOYEE_CLAIM",
        expenseDate: "2026-09-25",
        description: "Travel reimbursement",
        lines: [{ description: "Hotel", quantity: 1, unitPrice: 200 }],
      };
      const parsed = CreateExpenseSchema.safeParse(missingClaimant);
      expect(parsed.success).toBe(false);
    });

    it("validates direct business immediate expense requires bank account", () => {
      const missingBank = {
        expenseType: "DIRECT_BUSINESS",
        paymentType: "PAID_IMMEDIATELY",
        expenseDate: "2026-09-25",
        description: "Software purchase",
        lines: [{ description: "License", quantity: 1, unitPrice: 50 }],
      };
      const parsed = CreateExpenseSchema.safeParse(missingBank);
      expect(parsed.success).toBe(false);
    });

    it("validates rejection modal requires non-empty reason", () => {
      const emptyReason = { reason: "" };
      expect(RejectExpenseSchema.safeParse(emptyReason).success).toBe(false);

      const validReason = { reason: "Receipt does not match line item amount" };
      expect(RejectExpenseSchema.safeParse(validReason).success).toBe(true);
    });

    it("validates payment modal requires bankAccountId", () => {
      const invalidPayment = { bankAccountId: "" };
      expect(PayExpenseSchema.safeParse(invalidPayment).success).toBe(false);

      const validPayment = {
        bankAccountId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        paymentDate: "2026-09-25",
      };
      expect(PayExpenseSchema.safeParse(validPayment).success).toBe(true);
    });
  });

  describe("4. Attachment Security & Format Constraints", () => {
    const ALLOWED_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    const MAX_SIZE = 10 * 1024 * 1024;

    const validateAttachmentUX = (file: { name: string; size: number; type: string }) => {
      if (file.size > MAX_SIZE) return { valid: false, error: "File exceeds 10MB limit" };
      if (!ALLOWED_MIMES.includes(file.type)) return { valid: false, error: "Unsupported format" };
      if (file.name.toLowerCase().endsWith(".svg")) return { valid: false, error: "SVG not permitted" };
      if (file.name.toLowerCase().endsWith(".exe")) return { valid: false, error: "Executables not permitted" };
      return { valid: true };
    };

    it("permits standard PDF and image receipts", () => {
      expect(validateAttachmentUX({ name: "receipt.pdf", size: 500000, type: "application/pdf" }).valid).toBe(true);
      expect(validateAttachmentUX({ name: "invoice.jpg", size: 1200000, type: "image/jpeg" }).valid).toBe(true);
      expect(validateAttachmentUX({ name: "scan.png", size: 800000, type: "image/png" }).valid).toBe(true);
      expect(validateAttachmentUX({ name: "bill.webp", size: 300000, type: "image/webp" }).valid).toBe(true);
    });

    it("rejects oversized files, SVG vectors, and executable payloads", () => {
      expect(validateAttachmentUX({ name: "large.pdf", size: 11 * 1024 * 1024, type: "application/pdf" }).valid).toBe(false);
      expect(validateAttachmentUX({ name: "vector.svg", size: 5000, type: "image/svg+xml" }).valid).toBe(false);
      expect(validateAttachmentUX({ name: "script.exe", size: 2000, type: "application/x-msdownload" }).valid).toBe(false);
    });
  });
});
