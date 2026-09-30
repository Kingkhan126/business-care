import { db } from "@/db/client";
import { Prisma } from "@prisma/client";

export class CreditNoteRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.creditNote.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        sourceInvoice: true,
        warehouse: true,
        lines: {
          include: {
            product: true,
            service: true,
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
    const where: Prisma.CreditNoteWhereInput = {
      organizationId,
      ...(options?.customerId ? { customerId: options.customerId } : {}),
      ...(options?.search
        ? {
            OR: [
              { creditNoteNumber: { contains: options.search, mode: "insensitive" } },
              { customer: { displayName: { contains: options.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.creditNote.findMany({
        where,
        include: {
          customer: {
            select: { id: true, customerNumber: true, displayName: true },
          },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.creditNote.count({ where }),
    ]);

    return { items, total };
  }
}
