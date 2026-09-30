import { db } from "@/db/client";
import { Prisma } from "@prisma/client";

export class CustomerPaymentRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.customerPayment.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        allocations: {
          include: {
            invoice: true,
          },
        },
      },
    });
  }

  static async listByOrg(
    organizationId: string,
    options?: {
      customerId?: string;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.CustomerPaymentWhereInput = {
      organizationId,
      ...(options?.customerId ? { customerId: options.customerId } : {}),
      ...(options?.search
        ? {
            OR: [
              { paymentNumber: { contains: options.search, mode: "insensitive" } },
              { reference: { contains: options.search, mode: "insensitive" } },
              { customer: { displayName: { contains: options.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.customerPayment.findMany({
        where,
        include: {
          customer: {
            select: { id: true, customerNumber: true, displayName: true },
          },
          allocations: {
            include: {
              invoice: { select: { id: true, invoiceNumber: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.customerPayment.count({ where }),
    ]);

    return { items, total };
  }
}
