import { db } from "@/db/client";
import { Prisma, ProductStatus } from "@prisma/client";

export class ServiceRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.service.findFirst({
      where: { id, organizationId },
      include: {
        category: true,
        unitOfMeasure: true,
      },
    });
  }

  static async findByCodeAndOrg(code: string, organizationId: string) {
    return db.service.findFirst({
      where: { code, organizationId },
    });
  }

  static async listByOrg(
    organizationId: string,
    options?: {
      search?: string;
      status?: ProductStatus;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.ServiceWhereInput = {
      organizationId,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search
        ? {
            OR: [
              { name: { contains: options.search, mode: "insensitive" } },
              { code: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.service.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          unitOfMeasure: { select: { id: true, name: true, symbol: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.service.count({ where }),
    ]);

    return { items, total };
  }

  static async create(data: Prisma.ServiceCreateInput) {
    return db.service.create({ data });
  }

  static async update(id: string, organizationId: string, data: Prisma.ServiceUpdateInput) {
    return db.service.updateMany({
      where: { id, organizationId },
      data,
    });
  }
}
