import { describe, it, expect, vi, afterEach } from "vitest";
import { CustomerService } from "@/server/services/CustomerService";
import { SupplierService } from "@/server/services/SupplierService";
import { InventoryService } from "@/server/services/InventoryService";
import { MasterDataService } from "@/server/services/MasterDataService";
import { CategoryRepository } from "@/server/repositories/CategoryRepository";
import { SessionUser } from "@/types/auth";
import { ValidationError, ConflictError } from "@/lib/errors";
import { db } from "@/db/client";

vi.mock("@/db/client", () => ({
  db: {
    $transaction: vi.fn((cb) => cb(db)),
    $queryRaw: vi.fn().mockResolvedValue([{ id: "prod_1" }]),
    customer: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    supplier: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
    },
    warehouse: {
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

describe("Phase 3 Concurrency, Race Conditions & Hierarchy Protection Suite", () => {
  const userOrgA: SessionUser = {
    id: "usr_owner_A",
    email: "owner@acme.com",
    name: "Owner User",
    activeOrganizationId: "org_A",
    roleId: "role_owner",
    roleName: "Owner",
    permissions: [
      "customers.read", "customers.create", "customers.update",
      "vendors.read", "vendors.create", "vendors.update",
      "products.read", "products.create", "products.update",
      "inventory.read", "inventory.update",
    ],
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: Applies row-level pessimistic locking for concurrent stock adjustments", async () => {
    (db.product.findFirst as any).mockResolvedValue({
      id: "prod_concurrent",
      sku: "SKU-CONC",
      name: "Concurrent Item",
      trackInventory: true,
      allowNegativeStock: true,
      organizationId: "org_A",
    });

    (db.warehouse.findFirst as any).mockResolvedValue({
      id: "wh_main",
      code: "WH-MAIN",
      name: "Main WH",
      isActive: true,
      organizationId: "org_A",
    });

    (db.inventoryItem.findUnique as any).mockResolvedValue({ quantity: 10 });
    (db.inventoryItem.upsert as any).mockResolvedValue({ id: "inv_1", quantity: 15 });
    (db.stockAdjustment.create as any).mockResolvedValue({ id: "adj_1", newQuantity: 15 });
    (db.auditLog.create as any).mockResolvedValue({});

    await InventoryService.adjustStock(userOrgA, {
      productId: "prod_concurrent",
      warehouseId: "wh_main",
      adjustmentType: "FOUND",
      quantityChange: 5,
      reason: "Concurrent add",
    });

    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.inventoryItem.upsert).toHaveBeenCalled();
  });

  it("Test 2: Rejects negative stock balance race condition when allowNegativeStock is false", async () => {
    (db.product.findFirst as any).mockResolvedValue({
      id: "prod_strict",
      name: "Strict Item",
      trackInventory: true,
      allowNegativeStock: false,
      organizationId: "org_A",
    });

    (db.warehouse.findFirst as any).mockResolvedValue({
      id: "wh_main",
      code: "WH-MAIN",
      name: "Main WH",
      isActive: true,
      organizationId: "org_A",
    });

    (db.inventoryItem.findUnique as any).mockResolvedValue({ quantity: 5 });

    await expect(
      InventoryService.adjustStock(userOrgA, {
        productId: "prod_strict",
        warehouseId: "wh_main",
        adjustmentType: "CORRECTION",
        quantityChange: -10,
        reason: "Excessive removal",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("Test 3: Retries customer auto-numbering on collision under high concurrency", async () => {
    (db.customer.count as any).mockResolvedValue(0);
    // First call collides (CUS-000001 exists), second call succeeds (CUS-000002 is free)
    (db.customer.findFirst as any)
      .mockResolvedValueOnce({ id: "cus_existing", customerNumber: "CUS-000001" })
      .mockResolvedValueOnce(null);

    (db.customer.create as any).mockImplementation(async ({ data }: any) => ({
      id: "cus_new",
      ...data,
    }));
    (db.auditLog.create as any).mockResolvedValue({});

    const result = await CustomerService.create(userOrgA, {
      displayName: "Concurrent Customer",
      currency: "USD",
      billingCountry: "US",
      shippingCountry: "US",
      status: "ACTIVE",
    });

    expect(result.customerNumber).toBe("CUS-000002");
    expect(db.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerNumber: "CUS-000002" }),
      })
    );
  });

  it("Test 4: Retries supplier auto-numbering on collision under high concurrency", async () => {
    (db.supplier.count as any).mockResolvedValue(0);
    // First call collides (SUP-000001 exists), second call succeeds (SUP-000002 is free)
    (db.supplier.findFirst as any)
      .mockResolvedValueOnce({ id: "sup_existing", supplierNumber: "SUP-000001" })
      .mockResolvedValueOnce(null);

    (db.supplier.create as any).mockImplementation(async ({ data }: any) => ({
      id: "sup_new",
      ...data,
    }));
    (db.auditLog.create as any).mockResolvedValue({});

    const result = await SupplierService.create(userOrgA, {
      displayName: "Concurrent Supplier",
      currency: "USD",
      country: "US",
      status: "ACTIVE",
    });

    expect(result.supplierNumber).toBe("SUP-000002");
    expect(db.supplier.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ supplierNumber: "SUP-000002" }),
      })
    );
  });

  it("Test 5: Blocks multi-level circular category hierarchy dependency loop (A -> B -> C -> A)", async () => {
    // Existing category A being updated to have parent C
    // C's parent is B, B's parent is A
    vi.spyOn(CategoryRepository, "findByIdAndOrg").mockImplementation(async (id: string) => {
      if (id === "cat_A") return { id: "cat_A", name: "Cat A", parentId: null } as any;
      if (id === "cat_B") return { id: "cat_B", name: "Cat B", parentId: "cat_A" } as any;
      if (id === "cat_C") return { id: "cat_C", name: "Cat C", parentId: "cat_B" } as any;
      return null;
    });

    await expect(
      MasterDataService.updateCategory(userOrgA, "cat_A", { parentId: "cat_C" })
    ).rejects.toThrow(ValidationError);
  });
});
