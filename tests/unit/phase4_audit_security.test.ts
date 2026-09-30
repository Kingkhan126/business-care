import { describe, it, expect, beforeEach, vi } from "vitest";
import { EstimateService } from "@/server/services/EstimateService";
import { InvoiceService } from "@/server/services/InvoiceService";
import { CustomerPaymentService } from "@/server/services/CustomerPaymentService";
import { SessionUser } from "@/types/auth";
import { ValidationError, NotFoundError } from "@/lib/errors";

vi.mock("@/db/client", () => {
  return {
    db: {
      $transaction: vi.fn(async (cb) => cb({
        estimate: {
          count: vi.fn().mockResolvedValue(0),
          findFirst: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
        salesInvoice: {
          count: vi.fn().mockResolvedValue(0),
          findFirst: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
        auditLog: { create: vi.fn() },
        $queryRaw: vi.fn().mockResolvedValue([]),
      })),
    },
  };
});

vi.mock("@/server/repositories/EstimateRepository", () => ({
  EstimateRepository: {
    findByIdAndOrg: vi.fn(),
    listByOrg: vi.fn(),
  },
}));

vi.mock("@/server/repositories/CustomerRepository", () => ({
  CustomerRepository: {
    findByIdAndOrg: vi.fn(),
  },
}));

vi.mock("@/server/repositories/InvoiceRepository", () => ({
  InvoiceRepository: {
    findByIdAndOrg: vi.fn(),
  },
}));

import { EstimateRepository } from "@/server/repositories/EstimateRepository";
import { CustomerRepository } from "@/server/repositories/CustomerRepository";
import { InvoiceRepository } from "@/server/repositories/InvoiceRepository";

describe("Phase 4 Security & Authorization Audit Suite", () => {
  const userOrg1: SessionUser = {
    id: "user-1",
    email: "admin@org1.com",
    name: "Org1 Admin",
    activeOrganizationId: "org-1",
    roleName: "ADMIN",
    permissions: ["estimates.read", "estimates.create", "estimates.update", "invoices.read", "invoices.create", "invoices.update", "payments.create"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject cross-tenant document lookups (NotFoundError)", async () => {
    vi.mocked(EstimateRepository.findByIdAndOrg).mockResolvedValue(null);

    await expect(EstimateService.getById(userOrg1, "est-belonging-to-org2")).rejects.toThrow(NotFoundError);
    expect(EstimateRepository.findByIdAndOrg).toHaveBeenCalledWith("est-belonging-to-org2", "org-1");
  });

  it("should reject estimate creation for inactive customer", async () => {
    vi.mocked(CustomerRepository.findByIdAndOrg).mockResolvedValue({
      id: "cust-inactive",
      organizationId: "org-1",
      displayName: "Inactive Client Inc",
      status: "INACTIVE",
    } as any);

    await expect(
      EstimateService.create(userOrg1, {
        customerId: "cust-inactive",
        issueDate: "2026-09-25",
        lines: [{ description: "Consulting", quantity: 1, unitPrice: 100 }],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should block direct manual status update to 'CONVERTED'", async () => {
    vi.mocked(EstimateRepository.findByIdAndOrg).mockResolvedValue({
      id: "est-1",
      estimateNumber: "EST-000001",
      organizationId: "org-1",
      status: "ACCEPTED",
    } as any);

    await expect(EstimateService.updateStatus(userOrg1, "est-1", "CONVERTED" as any)).rejects.toThrow(
      "Direct manual status update to 'CONVERTED' is prohibited."
    );
  });

  it("should prevent issuing an invoice that is already ISSUED or PAID", async () => {
    const { db } = await import("@/db/client");

    vi.mocked(db.$transaction).mockImplementationOnce(async (cb: any) => {
      return cb({
        $queryRaw: vi.fn().mockResolvedValue([]),
        salesInvoice: {
          findFirst: vi.fn().mockResolvedValue({
            id: "inv-already-issued",
            invoiceNumber: "INV-000001",
            organizationId: "org-1",
            status: "ISSUED",
            lines: [],
          }),
        },
      });
    });

    await expect(InvoiceService.issueInvoice(userOrg1, "inv-already-issued")).rejects.toThrow(ValidationError);
  });
});
