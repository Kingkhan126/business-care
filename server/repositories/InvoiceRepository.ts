import { db } from "@/db/client";
import { Prisma, InvoiceStatus } from "@prisma/client";

export class InvoiceRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.salesInvoice.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        sourceSalesOrder: true,
        warehouse: true,
        lines: {
          include: {
            product: true,
            service: true,
          },
        },
        paymentAllocations: {
          include: {
            payment: true,
          },
        },
      },
    });
  }

  static async findByNumberAndOrg(invoiceNumber: string, organizationId: string) {
    return db.salesInvoice.findFirst({
      where: { invoiceNumber, organizationId },
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
      status?: InvoiceStatus;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.SalesInvoiceWhereInput = {
      organizationId,
      ...(options?.customerId ? { customerId: options.customerId } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search
        ? {
            OR: [
              { invoiceNumber: { contains: options.search, mode: "insensitive" } },
              { customer: { displayName: { contains: options.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.salesInvoice.findMany({
        where,
        include: {
          customer: {
            select: { id: true, customerNumber: true, displayName: true, email: true },
          },
          _count: { select: { lines: true, paymentAllocations: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.salesInvoice.count({ where }),
    ]);

    return { items, total };
  }
}
