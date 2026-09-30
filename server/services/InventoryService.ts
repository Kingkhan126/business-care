import { db } from "@/db/client";
import { Prisma } from "@prisma/client";
import { InventoryRepository } from "../repositories/InventoryRepository";
import { ProductRepository } from "../repositories/ProductRepository";
import { WarehouseRepository } from "../repositories/WarehouseRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { StockAdjustmentInput } from "@/lib/validation/master_data";

export class InventoryService {
  static async listStockBalances(
    user: SessionUser,
    options?: { warehouseId?: string; productId?: string; search?: string; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "inventory.read");

    return InventoryRepository.listByOrg(user.activeOrganizationId, options);
  }

  static async listStockAdjustments(
    user: SessionUser,
    options?: { productId?: string; warehouseId?: string; skip?: number; take?: number }
  ) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "inventory.read");

    return InventoryRepository.listAdjustments(user.activeOrganizationId, options);
  }

  static async adjustStock(user: SessionUser, input: StockAdjustmentInput, txPrisma?: Prisma.TransactionClient) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "inventory.update");

    const product = await ProductRepository.findByIdAndOrg(input.productId, user.activeOrganizationId);
    if (!product) {
      throw new NotFoundError("Product not found in your organization");
    }

    if (!product.trackInventory) {
      throw new ValidationError(`Inventory tracking is disabled for product '${product.name}'.`);
    }

    const warehouse = await WarehouseRepository.findByIdAndOrg(input.warehouseId, user.activeOrganizationId);
    if (!warehouse) {
      throw new NotFoundError("Warehouse not found in your organization");
    }

    if (!warehouse.isActive) {
      throw new ValidationError(`Warehouse '${warehouse.name}' is currently inactive.`);
    }

    const executeAdjustment = async (tx: Prisma.TransactionClient) => {
      // Row-level pessimistic lock on Product to eliminate concurrent stock adjustment race conditions
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${input.productId} FOR UPDATE`;

      // Fetch or initialize current balance
      const currentItem = await tx.inventoryItem.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: input.warehouseId,
            productId: input.productId,
          },
        },
      });

      const previousQuantity = currentItem ? Number(currentItem.quantity) : 0;
      const newQuantity = previousQuantity + input.quantityChange;

      if (newQuantity < 0 && !product.allowNegativeStock) {
        throw new ValidationError(
          `Adjustment of ${input.quantityChange} would result in negative stock balance (${newQuantity}), which is prohibited for product '${product.name}'.`
        );
      }

      // Upsert balance
      const updatedItem = await tx.inventoryItem.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: input.warehouseId,
            productId: input.productId,
          },
        },
        update: {
          quantity: newQuantity,
        },
        create: {
          organizationId: user.activeOrganizationId!,
          warehouseId: input.warehouseId,
          productId: input.productId,
          quantity: newQuantity,
        },
      });

      // Record adjustment audit log
      const adjustment = await tx.stockAdjustment.create({
        data: {
          organizationId: user.activeOrganizationId!,
          warehouseId: input.warehouseId,
          productId: input.productId,
          adjustmentType: input.adjustmentType,
          quantityChange: input.quantityChange,
          previousQuantity,
          newQuantity,
          reason: input.reason,
          notes: input.notes,
          createdById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.activeOrganizationId!,
          actorId: user.id,
          action: "stock.adjusted",
          entityType: "StockAdjustment",
          entityId: adjustment.id,
          metadata: {
            productSku: product.sku,
            warehouseCode: warehouse.code,
            adjustmentType: input.adjustmentType,
            quantityChange: input.quantityChange,
            newQuantity,
          },
        },
      });

      return {
        inventoryItem: updatedItem,
        adjustment,
      };
    };

    if (txPrisma) {
      return executeAdjustment(txPrisma);
    }

    return db.$transaction(async (tx) => executeAdjustment(tx));
  }
}
