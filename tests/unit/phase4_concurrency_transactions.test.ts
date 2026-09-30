import { describe, it, expect, vi, afterEach } from "vitest";
import { EstimateService } from "@/server/services/EstimateService";
import { InvoiceService } from "@/server/services/InvoiceService";
import { CustomerPaymentService } from "@/server/services/CustomerPaymentService";
import { PurchaseOrderService } from "@/server/services/PurchaseOrderService";
import { VendorBillService } from "@/server/services/VendorBillService";
import { SessionUser } from "@/types/auth";
import { ValidationError, ConflictError } from "@/lib/errors";
import { db } from "@/db/client";

vi.mock("@/db/client", () => ({
  db: {
    $transaction: vi.fn((cb) => cb(db)),
    $queryRaw: vi.fn().mockResolvedValue([{ balanceDue: 100 }]),
    estimate: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    salesOrder: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    salesInvoice: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customerPayment: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customerPaymentAllocation: {
      create: vi.fn(),
    },
    purchaseOrder: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    vendorBill: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
    },
    supplier: {
      findFirst: vi.fn(),
    },
    warehouse: {
      findFirst: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
    },
    inventoryItem: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    stockAdjustment: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe("Phase 4 Transaction Concurrency & Integrity Suite", () => {
  const userOrgA: SessionUser = {
    id: "usr_owner_A",
    email: "owner@acme.com",
    name: "Owner User",
    activeOrganizationId: "org_A",
    roleId: "role_owner",
    roleName: "Owner",
    permissions: [
      "customers.read", "vendors.read",
      "estimates.read", "estimates.create", "estimates.update",
      "orders.read", "orders.create", "orders.update",
      "invoices.read", "invoices.create", "invoices.update",
      "payments.read", "payments.create",
      "purchases.read", "purchases.create", "purchases.update",
      "inventory.read", "inventory.update",
    ],
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: Retries invoice auto-numbering on collision under high concurrency", async () => {
    (db.customer.findFirst as any).mockResolvedValue({ id: "cust_1", status: "ACTIVE" });
    (db.salesInvoice.count as any).mockResolvedValue(0);
    // First call collides (INV-000001 exists), second call succeeds (INV-000002 is free)
    (db.salesInvoice.findFirst as any)
      .mockResolvedValueOnce({ id: "inv_existing", invoiceNumber: "INV-000001" })
      .mockResolvedValueOnce(null);

    (db.salesInvoice.create as any).mockImplementation(async ({ data }: any) => ({
      id: "inv_new",
      ...data,
    }));
    (db.auditLog.create as any).mockResolvedValue({});

    const result = await InvoiceService.create(userOrgA, {
      customerId: "cust_1",
      issueDate: "2026-10-01",
      dueDate: "2026-11-01",
      lines: [{ description: "Concurrent Item", quantity: 1, unitPrice: 100 }],
    });

    expect(result.invoiceNumber).toBe("INV-000002");
  });

  it("Test 2: Prevents payment over-allocation when allocation amount exceeds balance due", async () => {
    (db.customerPayment.findFirst as any).mockResolvedValue({
      id: "pay_1",
      paymentNumber: "PAY-000001",
      customerId: "cust_1",
      amount: 500,
      unallocatedAmount: 500,
    });
    (db.salesInvoice.findFirst as any).mockResolvedValue({
      id: "inv_1",
      invoiceNumber: "INV-000001",
      customerId: "cust_1",
      status: "ISSUED",
      amountPaid: 0,
      balanceDue: 200, // Balance due is only 200
    });

    await expect(
      CustomerPaymentService.allocatePayment(userOrgA, "pay_1", {
        invoiceId: "inv_1",
        allocatedAmount: 300, // Allocation of 300 exceeds 200 balance due!
      })
    ).rejects.toThrow(ValidationError);
  });

  it("Test 3: Prevents duplicate conversion of an already converted Estimate", async () => {
    (db.estimate.findFirst as any).mockResolvedValue({
      id: "est_1",
      estimateNumber: "EST-000001",
      customerId: "cust_1",
      status: "CONVERTED", // Already converted
      convertedSalesOrderId: "so_existing",
      lines: [],
    });

    await expect(EstimateService.convertToSalesOrder(userOrgA, "est_1")).rejects.toThrow(ValidationError);
  });
});
