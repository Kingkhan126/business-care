import { db } from "@/db/client";
import { Prisma } from "@prisma/client";

export class CategoryRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.productCategory.findFirst({
      where: { id, organizationId },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  static async findByNameAndOrg(name: string, organizationId: string) {
    return db.productCategory.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, organizationId },
    });
  }

  static async listByOrg(organizationId: string) {
    return db.productCategory.findMany({
      where: { organizationId },
      include: {
        parent: {
          select: { id: true, name: true },
        },
        children: {
          select: { id: true, name: true },
        },
        _count: {
          select: { products: true, services: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  static async create(data: Prisma.ProductCategoryCreateInput) {
    return db.productCategory.create({ data });
  }

  static async update(id: string, organizationId: string, data: Prisma.ProductCategoryUpdateInput) {
    return db.productCategory.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  static async delete(id: string, organizationId: string) {
    return db.productCategory.deleteMany({
      where: { id, organizationId },
    });
  }
}
