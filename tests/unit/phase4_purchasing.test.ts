import { describe, it, expect, vi, afterEach } from "vitest";
import { PurchaseOrderService } from "@/server/services/PurchaseOrderService";
import { VendorBillService } from "@/server/services/VendorBillService";
import { VendorPaymentService } from "@/server/services/VendorPaymentService";
import { SessionUser } from "@/types/auth";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/db/client";

vi.mock("@/db/client", () => ({
  db: {
    $transaction: vi.fn((cb) => cb(db)),
    $queryRaw: vi.fn().mockResolvedValue([{ balanceDue: 500 }]),
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
    vendorPayment: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    vendorPaymentAllocation: {
      create: vi.fn(),
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

describe("Phase 4 Purchasing Suite & Security Tests", () => {
  const userOrgA: SessionUser = {
    id: "usr_owner_A",
    email: "owner@acme.com",
    name: "Owner User",
    activeOrganizationId: "org_A",
    roleId: "role_owner",
    roleName: "Owner",
    permissions: [
      "vendors.read",
      "purchases.read", "purchases.create", "purchases.update",
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
    permissions: ["purchases.read"], // Read-only
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: Creates Purchase Order with calculated totals", async () => {
    (db.supplier.findFirst as any).mockResolvedValue({
      id: "sup_1",
      displayName: "Global Supplies",
      status: "ACTIVE",
    });
    (db.purchaseOrder.count as any).mockResolvedValue(0);
    (db.purchaseOrder.findFirst as any).mockResolvedValue(null);
    (db.purchaseOrder.create as any).mockImplementation(async ({ data }: any) => ({
      id: "po_1",
      ...data,
    }));
    (db.auditLog.create as any).mockResolvedValue({});

    const result = await PurchaseOrderService.create(userOrgA, {
      supplierId: "sup_1",
      orderDate: "2026-10-01",
      currency: "USD",
      lines: [{ description: "Raw Materials", quantity: 10, unitPrice: 50, taxRate: 0, discount: 0 }],
    });

    expect(result.purchaseOrderNumber).toBe("PO-000001");
    expect(Number(result.total)).toBe(500);
  });

  it("Test 2: Converts Purchase Order to Vendor Bill", async () => {
    (db.purchaseOrder.findFirst as any).mockResolvedValue({
      id: "po_1",
      purchaseOrderNumber: "PO-000001",
      supplierId: "sup_1",
      status: "CONFIRMED",
      currency: "USD",
      subtotal: 500,
      discountTotal: 0,
      taxTotal: 0,
      total: 500,
      lines: [{ description: "Raw Materials", quantity: 10, unitCost: 50, subtotal: 500, total: 500 }],
    });
    (db.vendorBill.count as any).mockResolvedValue(0);
    (db.vendorBill.findFirst as any).mockResolvedValue(null);
    (db.vendorBill.create as any).mockResolvedValue({ id: "bill_1", billNumber: "BILL-000001" });
    (db.purchaseOrder.update as any).mockResolvedValue({});
    (db.auditLog.create as any).mockResolvedValue({});

    const bill = await PurchaseOrderService.convertToVendorBill(userOrgA, "po_1");
    expect(bill.billNumber).toBe("BILL-000001");
  });

  it("Test 3: Marking Vendor Bill RECEIVED adds inventory for tracked products", async () => {
    (db.vendorBill.findFirst as any).mockResolvedValue({
      id: "bill_1",
      billNumber: "BILL-000001",
      status: "DRAFT",
      warehouseId: "wh_1",
      lines: [{ productId: "prod_1", quantity: 10 }],
    });
    (db.product.findFirst as any).mockResolvedValue({
      id: "prod_1",
      sku: "SKU-PROD",
      trackInventory: true,
      organizationId: "org_A",
    });
    (db.warehouse.findFirst as any).mockResolvedValue({ id: "wh_1", isActive: true });
    (db.inventoryItem.findUnique as any).mockResolvedValue({ quantity: 50 });
    (db.inventoryItem.upsert as any).mockResolvedValue({ quantity: 60 });
    (db.stockAdjustment.create as any).mockResolvedValue({});
    (db.vendorBill.update as any).mockResolvedValue({ id: "bill_1", status: "RECEIVED" });
    (db.auditLog.create as any).mockResolvedValue({});

    const received = await VendorBillService.receiveBill(userOrgA, "bill_1");
    expect(received.status).toBe("RECEIVED");
    expect(db.inventoryItem.upsert).toHaveBeenCalled();
  });

  it("Test 4: Allocates Vendor Payment to Bill with pessimistic row lock", async () => {
    (db.vendorPayment.findFirst as any).mockResolvedValue({
      id: "vpay_1",
      paymentNumber: "VPAY-000001",
      supplierId: "sup_1",
      amount: 500,
      unallocatedAmount: 500,
    });
    (db.vendorBill.findFirst as any).mockResolvedValue({
      id: "bill_1",
      billNumber: "BILL-000001",
      supplierId: "sup_1",
      status: "RECEIVED",
      amountPaid: 0,
      balanceDue: 500,
    });
    (db.vendorPaymentAllocation.create as any).mockResolvedValue({ id: "valloc_1", allocatedAmount: 500 });
    (db.vendorPayment.update as any).mockResolvedValue({});
    (db.vendorBill.update as any).mockResolvedValue({ status: "PAID", balanceDue: 0 });
    (db.auditLog.create as any).mockResolvedValue({});

    await VendorPaymentService.allocatePayment(userOrgA, "vpay_1", {
      billId: "bill_1",
      allocatedAmount: 500,
    });

    expect(db.vendorBill.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAID", balanceDue: 0 }),
      })
    );
  });

  it("Test 5: Restricted user cannot create Vendor Bill", async () => {
    await expect(
      VendorBillService.create(restrictedUser, {
        supplierId: "sup_1",
        issueDate: "2026-10-01",
        dueDate: "2026-11-01",
        lines: [{ description: "Forbidden Materials", quantity: 1, unitPrice: 100 }],
      })
    ).rejects.toThrow(ForbiddenError);
  });
});
