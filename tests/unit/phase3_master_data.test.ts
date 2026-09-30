import { describe, it, expect, vi, afterEach } from "vitest";
import { CustomerService } from "@/server/services/CustomerService";
import { SupplierService } from "@/server/services/SupplierService";
import { ProductService } from "@/server/services/ProductService";
import { ServiceItemService } from "@/server/services/ServiceItemService";
import { InventoryService } from "@/server/services/InventoryService";
import { MasterDataService } from "@/server/services/MasterDataService";
import { SessionUser } from "@/types/auth";
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { db } from "@/db/client";
import { CustomerSchema, SupplierSchema } from "@/lib/validation/master_data";

vi.mock("@/db/client", () => ({
  db: {
    $transaction: vi.fn((cb) => cb(db)),
    $queryRaw: vi.fn().mockResolvedValue([{ id: "prod_1" }]),
    customer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    supplier: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    service: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productCategory: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    unitOfMeasure: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    warehouse: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    inventoryItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },
    stockAdjustment: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe("Phase 3 Master Data & Inventory Security & Business Rules Suite", () => {
  const userOrgA: SessionUser = {
    id: "usr_owner_A",
    email: "owner@acme.com",
    name: "Owner User",
    activeOrganizationId: "org_A",
    roleId: "role_owner",
    roleName: "Owner",
    permissions: [
      "customers.read", "customers.create", "customers.update", "customers.delete",
      "vendors.read", "vendors.create", "vendors.update",
      "products.read", "products.create", "products.update", "products.delete",
      "inventory.read", "inventory.update",
    ],
  };

  const restrictedUserOrgA: SessionUser = {
    id: "usr_restricted",
    email: "viewer@acme.com",
    name: "Viewer User",
    activeOrganizationId: "org_A",
    roleId: "role_viewer",
    roleName: "Viewer",
    permissions: ["customers.read", "vendors.read", "products.read", "inventory.read"], // Missing create/update
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: Customer Creation & Auto Numbering
  it("Test 1: Creates customer with organization-scoped auto-numbering", async () => {
    (db.customer.count as any).mockResolvedValue(0);
    (db.customer.findFirst as any).mockResolvedValue(null);
    (db.customer.create as any).mockImplementation(async ({ data }: any) => ({
      id: "cus_1",
      ...data,
    }));
    (db.auditLog.create as any).mockResolvedValue({});

    const input = CustomerSchema.parse({
      displayName: "Acme Client Corp",
      email: "client@acme.com",
      currency: "USD",
      status: "ACTIVE",
    });

    const result = await CustomerService.create(userOrgA, input);

    expect(result.customerNumber).toBe("CUS-000001");
    expect(db.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org_A",
          customerNumber: "CUS-000001",
        }),
      })
    );
  });

  // Test 2: Tenant Isolation — Org A cannot access Org B Customer
  it("Test 2: Org A user cannot access Org B customer record", async () => {
    (db.customer.findFirst as any).mockResolvedValue(null); // Not found in Org A

    await expect(CustomerService.getById(userOrgA, "cus_org_B")).rejects.toThrow(NotFoundError);
  });

  // Test 3: Restricted user cannot create supplier
  it("Test 3: User without vendors.create permission cannot create supplier", async () => {
    const input = SupplierSchema.parse({
      displayName: "Forbidden Supplier",
      currency: "USD",
      status: "ACTIVE",
    });

    await expect(SupplierService.create(restrictedUserOrgA, input)).rejects.toThrow(ForbiddenError);
  });

  // Test 4: Physical Product SKU Uniqueness per Organization
  it("Test 4: Prevents duplicate SKU creation in the same organization", async () => {
    (db.product.findFirst as any).mockResolvedValue({ id: "prod_existing", sku: "SKU-001" });

    await expect(
      ProductService.create(userOrgA, {
        sku: "SKU-001",
        name: "Duplicate SKU Item",
        costPrice: 10,
        sellingPrice: 20,
        trackInventory: true,
        allowNegativeStock: false,
        currency: "USD",
        status: "ACTIVE",
      })
    ).rejects.toThrow(ConflictError);
  });

  // Test 5: Service Item Cannot Be Used for Stock Adjustments
  it("Test 5: Rejects stock adjustment for non-inventory products", async () => {
    (db.product.findFirst as any).mockResolvedValue({
      id: "prod_service",
      name: "Consulting Service",
      trackInventory: false, // Non-stock item
      organizationId: "org_A",
    });

    await expect(
      InventoryService.adjustStock(userOrgA, {
        productId: "prod_service",
        warehouseId: "wh_1",
        adjustmentType: "CORRECTION",
        quantityChange: 10,
        reason: "Test adjustment",
      })
    ).rejects.toThrow(ValidationError);
  });

  // Test 6: Negative Stock Prohibited when allowNegativeStock = false
  it("Test 6: Prohibits negative stock balance when allowNegativeStock is false", async () => {
    (db.product.findFirst as any).mockResolvedValue({
      id: "prod_strict",
      name: "Strict Physical Item",
      trackInventory: true,
      allowNegativeStock: false,
      organizationId: "org_A",
    });

    (db.warehouse.findFirst as any).mockResolvedValue({
      id: "wh_main",
      name: "Main Warehouse",
      code: "WH-MAIN",
      isActive: true,
      organizationId: "org_A",
    });

    (db.inventoryItem.findUnique as any).mockResolvedValue({
      quantity: 5, // Current balance is 5
    });

    await expect(
      InventoryService.adjustStock(userOrgA, {
        productId: "prod_strict",
        warehouseId: "wh_main",
        adjustmentType: "CORRECTION",
        quantityChange: -10, // Resulting balance = -5 (Prohibited!)
        reason: "Damage count",
      })
    ).rejects.toThrow(ValidationError);
  });

  // Test 7: Stock Adjustment Success & Transaction Execution
  it("Test 7: Adjusts stock balance atomically inside a transaction", async () => {
    (db.product.findFirst as any).mockResolvedValue({
      id: "prod_ok",
      sku: "SKU-OK",
      name: "Physical Item OK",
      trackInventory: true,
      allowNegativeStock: false,
      organizationId: "org_A",
    });

    (db.warehouse.findFirst as any).mockResolvedValue({
      id: "wh_main",
      name: "Main Warehouse",
      code: "WH-MAIN",
      isActive: true,
      organizationId: "org_A",
    });

    (db.inventoryItem.findUnique as any).mockResolvedValue({
      quantity: 10,
    });

    (db.inventoryItem.upsert as any).mockResolvedValue({
      id: "inv_item_1",
      quantity: 15,
    });

    (db.stockAdjustment.create as any).mockResolvedValue({
      id: "adj_1",
      quantityChange: 5,
      previousQuantity: 10,
      newQuantity: 15,
    });

    (db.auditLog.create as any).mockResolvedValue({});

    const result = await InventoryService.adjustStock(userOrgA, {
      productId: "prod_ok",
      warehouseId: "wh_main",
      adjustmentType: "FOUND",
      quantityChange: 5,
      reason: "Found extra stock",
    });

    expect(db.$transaction).toHaveBeenCalled();
    expect(result.adjustment.newQuantity).toBe(15);
  });
});
