import { db } from "@/db/client";
import { Prisma } from "@prisma/client";

export class WarehouseRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.warehouse.findFirst({
      where: { id, organizationId },
    });
  }

  static async findByCodeAndOrg(code: string, organizationId: string) {
    return db.warehouse.findFirst({
      where: { code, organizationId },
    });
  }

  static async findDefaultByOrg(organizationId: string) {
    return db.warehouse.findFirst({
      where: { organizationId, isDefault: true, isActive: true },
    });
  }

  static async listByOrg(organizationId: string) {
    return db.warehouse.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { inventoryItems: true, stockAdjustments: true },
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  static async create(data: Prisma.WarehouseCreateInput) {
    return db.warehouse.create({ data });
  }

  static async update(id: string, organizationId: string, data: Prisma.WarehouseUpdateInput) {
    return db.warehouse.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  static async clearDefaultFlag(organizationId: string) {
    return db.warehouse.updateMany({
      where: { organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }
}
