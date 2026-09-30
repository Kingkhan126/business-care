import { db } from "@/db/client";
import { Prisma, EstimateStatus } from "@prisma/client";

export class EstimateRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.estimate.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        lines: {
          include: {
            product: true,
            service: true,
          },
        },
      },
    });
  }

  static async findByNumberAndOrg(estimateNumber: string, organizationId: string) {
    return db.estimate.findFirst({
      where: { estimateNumber, organizationId },
      include: {
        customer: true,
        lines: true,
      },
    });
  }

  static async listByOrg(
    organizationId: string,
    options?: {
      customerId?: string;
      status?: EstimateStatus;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.EstimateWhereInput = {
      organizationId,
      ...(options?.customerId ? { customerId: options.customerId } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search
        ? {
            OR: [
              { estimateNumber: { contains: options.search, mode: "insensitive" } },
              { customer: { displayName: { contains: options.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.estimate.findMany({
        where,
        include: {
          customer: {
            select: { id: true, customerNumber: true, displayName: true, email: true },
          },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.estimate.count({ where }),
    ]);

    return { items, total };
  }
}
