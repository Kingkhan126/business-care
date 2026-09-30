import { db } from "@/db/client";
import { Prisma, SalesOrderStatus } from "@prisma/client";

export class SalesOrderRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.salesOrder.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        sourceEstimate: true,
        lines: {
          include: {
            product: true,
            service: true,
          },
        },
      },
    });
  }

  static async findByNumberAndOrg(orderNumber: string, organizationId: string) {
    return db.salesOrder.findFirst({
      where: { orderNumber, organizationId },
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
      status?: SalesOrderStatus;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.SalesOrderWhereInput = {
      organizationId,
      ...(options?.customerId ? { customerId: options.customerId } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search
        ? {
            OR: [
              { orderNumber: { contains: options.search, mode: "insensitive" } },
              { customer: { displayName: { contains: options.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.salesOrder.findMany({
        where,
        include: {
          customer: {
            select: { id: true, customerNumber: true, displayName: true, email: true },
          },
          _count: { select: { lines: true, invoices: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.salesOrder.count({ where }),
    ]);

    return { items, total };
  }
}
