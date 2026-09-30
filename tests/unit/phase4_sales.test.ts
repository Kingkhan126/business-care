import { describe, it, expect, vi, afterEach } from "vitest";
import { EstimateService } from "@/server/services/EstimateService";
import { SalesOrderService } from "@/server/services/SalesOrderService";
import { InvoiceService } from "@/server/services/InvoiceService";
import { CustomerPaymentService } from "@/server/services/CustomerPaymentService";
import { SessionUser } from "@/types/auth";
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
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
    customer: {
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

describe("Phase 4 Sales Suite & Security Tests", () => {
  const userOrgA: SessionUser = {
    id: "usr_owner_A",
    email: "owner@acme.com",
    name: "Owner User",
    activeOrganizationId: "org_A",
    roleId: "role_owner",
    roleName: "Owner",
    permissions: [
      "customers.read",
      "estimates.read", "estimates.create", "estimates.update",
      "orders.read", "orders.create", "orders.update",
      "invoices.read", "invoices.create", "invoices.update",
      "payments.read", "payments.create",
      "inventory.read", "inventory.update",
    ],
  };

  const restrictedUser: SessionUser = {
    id: "usr_viewer",
    email: "viewer@acme.com",
    name: "Viewer User",
    activeOrganizationId: "org_A",
    roleId: "role_viewer",
    roleName: "Viewer",
    permissions: ["estimates.read"], // Lacks create/update/payment perms
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: Estimate Creation
  it("Test 1: Creates Estimate with calculated totals and auto-numbering", async () => {
    (db.customer.findFirst as any).mockResolvedValue({
      id: "cust_1",
      displayName: "Acme Client",
      status: "ACTIVE",
    });
    (db.estimate.count as any).mockResolvedValue(0);
    (db.estimate.findFirst as any).mockResolvedValue(null);
    (db.estimate.create as any).mockImplementation(async ({ data }: any) => ({
      id: "est_1",
      ...data,
    }));
    (db.auditLog.create as any).mockResolvedValue({});

    const result = await EstimateService.create(userOrgA, {
      customerId: "cust_1",
      issueDate: "2026-10-01",
      currency: "USD",
      lines: [{ description: "Consulting Item", quantity: 2, unitPrice: 100, taxRate: 10, discount: 0 }],
    });

    expect(result.estimateNumber).toBe("EST-000001");
    expect(Number(result.total)).toBe(220); // 200 + 10% tax = 220
  });

  // Test 2: Estimate Conversion to Sales Order
  it("Test 2: Converts ACCEPTED estimate to Sales Order", async () => {
    (db.estimate.findFirst as any).mockResolvedValue({
      id: "est_1",
      estimateNumber: "EST-000001",
      customerId: "cust_1",
      status: "ACCEPTED",
      currency: "USD",
      subtotal: 200,
      discountTotal: 0,
      taxTotal: 20,
      total: 220,
      lines: [{ description: "Item 1", quantity: 2, unitPrice: 100, subtotal: 200, total: 220 }],
    });
    (db.salesOrder.count as any).mockResolvedValue(0);
    (db.salesOrder.findFirst as any).mockResolvedValue(null);
    (db.salesOrder.create as any).mockResolvedValue({ id: "so_1", orderNumber: "SO-000001" });
    (db.estimate.update as any).mockResolvedValue({});
    (db.auditLog.create as any).mockResolvedValue({});

    const order = await EstimateService.convertToSalesOrder(userOrgA, "est_1");
    expect(order.orderNumber).toBe("SO-000001");
  });

  // Test 3: Invoice Issuing triggers Inventory Stock Deduction
  it("Test 3: Issuing an invoice deducts inventory for tracked physical products", async () => {
    (db.salesInvoice.findFirst as any).mockResolvedValue({
      id: "inv_1",
      invoiceNumber: "INV-000001",
      status: "DRAFT",
      warehouseId: "wh_1",
      lines: [{ productId: "prod_physical", quantity: 5 }],
    });
    (db.product.findFirst as any).mockResolvedValue({
      id: "prod_physical",
      sku: "SKU-PHYS",
      trackInventory: true,
      organizationId: "org_A",
    });
    (db.warehouse.findFirst as any).mockResolvedValue({
      id: "wh_1",
      code: "WH-MAIN",
      isActive: true,
    });
    (db.inventoryItem.findUnique as any).mockResolvedValue({ quantity: 20 });
    (db.inventoryItem.upsert as any).mockResolvedValue({ quantity: 15 });
    (db.stockAdjustment.create as any).mockResolvedValue({});
    (db.salesInvoice.update as any).mockResolvedValue({ id: "inv_1", status: "ISSUED" });
    (db.auditLog.create as any).mockResolvedValue({});

    const issued = await InvoiceService.issueInvoice(userOrgA, "inv_1");
    expect(issued.status).toBe("ISSUED");
    expect(db.inventoryItem.upsert).toHaveBeenCalled();
  });

  // Test 4: Payment Allocation
  it("Test 4: Allocates customer payment to invoice and updates balance due", async () => {
    (db.customerPayment.findFirst as any).mockResolvedValue({
      id: "pay_1",
      paymentNumber: "PAY-000001",
      customerId: "cust_1",
      amount: 100,
      unallocatedAmount: 100,
    });
    (db.salesInvoice.findFirst as any).mockResolvedValue({
      id: "inv_1",
      invoiceNumber: "INV-000001",
      customerId: "cust_1",
      status: "ISSUED",
      amountPaid: 0,
      balanceDue: 100,
    });
    (db.customerPaymentAllocation.create as any).mockResolvedValue({ id: "alloc_1", allocatedAmount: 100 });
    (db.customerPayment.update as any).mockResolvedValue({});
    (db.salesInvoice.update as any).mockResolvedValue({ status: "PAID", balanceDue: 0 });
    (db.auditLog.create as any).mockResolvedValue({});

    const alloc = await CustomerPaymentService.allocatePayment(userOrgA, "pay_1", {
      invoiceId: "inv_1",
      allocatedAmount: 100,
    });

    expect(db.salesInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAID", balanceDue: 0 }),
      })
    );
  });

  // Test 5: Security — User without permission cannot create invoice
  it("Test 5: Restricted user cannot create invoice", async () => {
    await expect(
      InvoiceService.create(restrictedUser, {
        customerId: "cust_1",
        issueDate: "2026-10-01",
        dueDate: "2026-11-01",
        lines: [{ description: "Forbidden Line", quantity: 1, unitPrice: 50 }],
      })
    ).rejects.toThrow(ForbiddenError);
  });

  // Test 6: Cross-Tenant Isolation — User cannot view Org B invoice
  it("Test 6: User cannot access invoice belonging to another organization", async () => {
    (db.salesInvoice.findFirst as any).mockResolvedValue(null); // Not found in Org A

    await expect(InvoiceService.getById(userOrgA, "inv_org_B")).rejects.toThrow(NotFoundError);
  });
});
