import { db } from "@/db/client";
import { Prisma, AdjustmentType } from "@prisma/client";

export class InventoryRepository {
  static async findItem(warehouseId: string, productId: string) {
    return db.inventoryItem.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId,
          productId,
        },
      },
      include: {
        product: true,
        warehouse: true,
      },
    });
  }

  static async listByOrg(
    organizationId: string,
    options?: {
      warehouseId?: string;
      productId?: string;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.InventoryItemWhereInput = {
      organizationId,
      ...(options?.warehouseId ? { warehouseId: options.warehouseId } : {}),
      ...(options?.productId ? { productId: options.productId } : {}),
      ...(options?.search
        ? {
            product: {
              OR: [
                { name: { contains: options.search, mode: "insensitive" } },
                { sku: { contains: options.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.inventoryItem.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              reorderLevel: true,
              unitOfMeasure: { select: { symbol: true, precision: true } },
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.inventoryItem.count({ where }),
    ]);

    return { items, total };
  }

  static async listAdjustments(
    organizationId: string,
    options?: {
      productId?: string;
      warehouseId?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.StockAdjustmentWhereInput = {
      organizationId,
      ...(options?.productId ? { productId: options.productId } : {}),
      ...(options?.warehouseId ? { warehouseId: options.warehouseId } : {}),
    };

    const [items, total] = await Promise.all([
      db.stockAdjustment.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.stockAdjustment.count({ where }),
    ]);

    return { items, total };
  }
}
