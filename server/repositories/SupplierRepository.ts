import { db } from "@/db/client";
import { Prisma, SupplierStatus } from "@prisma/client";

export class SupplierRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.supplier.findFirst({
      where: { id, organizationId },
    });
  }

  static async findByNumberAndOrg(supplierNumber: string, organizationId: string) {
    return db.supplier.findFirst({
      where: { supplierNumber, organizationId },
    });
  }

  static async listByOrg(
    organizationId: string,
    options?: {
      search?: string;
      status?: SupplierStatus;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.SupplierWhereInput = {
      organizationId,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search
        ? {
            OR: [
              { displayName: { contains: options.search, mode: "insensitive" } },
              { supplierNumber: { contains: options.search, mode: "insensitive" } },
              { email: { contains: options.search, mode: "insensitive" } },
              { phone: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.supplier.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.supplier.count({ where }),
    ]);

    return { items, total };
  }

  static async create(data: Prisma.SupplierCreateInput) {
    return db.supplier.create({ data });
  }

  static async update(id: string, organizationId: string, data: Prisma.SupplierUpdateInput) {
    return db.supplier.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  static async countByOrg(organizationId: string): Promise<number> {
    return db.supplier.count({ where: { organizationId } });
  }
}
