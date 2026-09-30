import { db } from "@/db/client";
import { Prisma, ProductStatus } from "@prisma/client";

export class ProductRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.product.findFirst({
      where: { id, organizationId },
      include: {
        category: true,
        unitOfMeasure: true,
        inventoryItems: {
          include: {
            warehouse: true,
          },
        },
      },
    });
  }

  static async findBySkuAndOrg(sku: string, organizationId: string) {
    return db.product.findFirst({
      where: { sku, organizationId },
    });
  }

  static async listByOrg(
    organizationId: string,
    options?: {
      search?: string;
      categoryId?: string;
      status?: ProductStatus;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
      ...(options?.search
        ? {
            OR: [
              { name: { contains: options.search, mode: "insensitive" } },
              { sku: { contains: options.search, mode: "insensitive" } },
              { barcode: { contains: options.search, mode: "insensitive" } },
              { brand: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          unitOfMeasure: { select: { id: true, name: true, symbol: true } },
          inventoryItems: {
            select: {
              warehouseId: true,
              quantity: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.product.count({ where }),
    ]);

    return { items, total };
  }

  static async create(data: Prisma.ProductCreateInput) {
    return db.product.create({ data });
  }

  static async update(id: string, organizationId: string, data: Prisma.ProductUpdateInput) {
    return db.product.updateMany({
      where: { id, organizationId },
      data,
    });
  }
}
