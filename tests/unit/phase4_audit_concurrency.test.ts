import { describe, it, expect, beforeEach, vi } from "vitest";
import { EstimateService } from "@/server/services/EstimateService";
import { SalesOrderService } from "@/server/services/SalesOrderService";
import { CustomerPaymentService } from "@/server/services/CustomerPaymentService";
import { InvoiceService } from "@/server/services/InvoiceService";
import { SessionUser } from "@/types/auth";
import { ValidationError, ConflictError } from "@/lib/errors";

vi.mock("@/db/client", () => {
  return {
    db: {
      $transaction: vi.fn(async (cb) => {
        const txMock = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          estimate: {
            findFirst: vi.fn(),
            update: vi.fn().mockResolvedValue({ id: "est-1", status: "CONVERTED" }),
          },
          salesOrder: {
            count: vi.fn().mockResolvedValue(0),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: "so-1", orderNumber: "SO-000001" }),
            update: vi.fn(),
          },
          salesInvoice: {
            count: vi.fn().mockResolvedValue(0),
            findFirst: vi.fn(),
            create: vi.fn().mockResolvedValue({ id: "inv-1", invoiceNumber: "INV-000001" }),
            update: vi.fn().mockResolvedValue({ id: "inv-1", status: "ISSUED" }),
          },
          customerPayment: {
            findFirst: vi.fn(),
            update: vi.fn(),
          },
          customerPaymentAllocation: {
            create: vi.fn().mockResolvedValue({ id: "alloc-1" }),
          },
          auditLog: { create: vi.fn() },
        };
        return cb(txMock);
      }),
    },
  };
});

describe("Phase 4 Concurrency & Race Condition Safeguards Suite", () => {
  const user: SessionUser = {
    id: "user-1",
    email: "admin@org1.com",
    name: "Admin User",
    activeOrganizationId: "org-1",
    roleName: "ADMIN",
    permissions: ["estimates.read", "orders.create", "invoices.create", "invoices.update", "payments.create"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should prevent duplicate conversions on already converted estimate", async () => {
    const { db } = await import("@/db/client");

    // Mock tx.estimate.findFirst returning an already converted estimate inside transaction
    vi.mocked(db.$transaction).mockImplementationOnce(async (cb: any) => {
      return cb({
        $queryRaw: vi.fn().mockResolvedValue([]),
        estimate: {
          findFirst: vi.fn().mockResolvedValue({
            id: "est-1",
            estimateNumber: "EST-000001",
            status: "CONVERTED",
            convertedSalesOrderId: "so-existing",
            lines: [],
          }),
        },
      });
    });

    await expect(EstimateService.convertToSalesOrder(user, "est-1")).rejects.toThrow(ValidationError);
  });

  it("should prevent duplicate invoice conversions on completed Sales Order", async () => {
    const { db } = await import("@/db/client");

    vi.mocked(db.$transaction).mockImplementationOnce(async (cb: any) => {
      return cb({
        $queryRaw: vi.fn().mockResolvedValue([]),
        salesOrder: {
          findFirst: vi.fn().mockResolvedValue({
            id: "so-1",
            orderNumber: "SO-000001",
            status: "COMPLETED",
            lines: [],
          }),
        },
      });
    });

    await expect(SalesOrderService.convertToInvoice(user, "so-1")).rejects.toThrow(ValidationError);
  });

  it("should enforce SELECT FOR UPDATE row locks on CustomerPayment and SalesInvoice during payment allocation", async () => {
    const { db } = await import("@/db/client");

    const mockQueryRaw = vi.fn().mockResolvedValue([]);
    vi.mocked(db.$transaction).mockImplementationOnce(async (cb: any) => {
      return cb({
        $queryRaw: mockQueryRaw,
        customerPayment: {
          findFirst: vi.fn().mockResolvedValue({
            id: "pay-1",
            customerId: "cust-1",
            unallocatedAmount: 500,
          }),
          update: vi.fn().mockResolvedValue({ id: "pay-1", unallocatedAmount: 200 }),
        },
        salesInvoice: {
          findFirst: vi.fn().mockResolvedValue({
            id: "inv-1",
            customerId: "cust-1",
            status: "ISSUED",
            amountPaid: 0,
            balanceDue: 300,
          }),
          update: vi.fn(),
        },
        customerPaymentAllocation: {
          create: vi.fn().mockResolvedValue({ id: "alloc-1" }),
        },
        auditLog: { create: vi.fn() },
      });
    });

    const result = await CustomerPaymentService.allocatePayment(user, "pay-1", {
      invoiceId: "inv-1",
      allocatedAmount: 300,
    });

    expect(result).toBeDefined();
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });
});
