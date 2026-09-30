import { db } from "@/db/client";
import { Prisma } from "@prisma/client";

export class VendorCreditRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.vendorCredit.findFirst({
      where: { id, organizationId },
      include: {
        supplier: true,
        sourceBill: true,
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
      supplierId?: string;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.VendorCreditWhereInput = {
      organizationId,
      ...(options?.supplierId ? { supplierId: options.supplierId } : {}),
      ...(options?.search
        ? {
            OR: [
              { vendorCreditNumber: { contains: options.search, mode: "insensitive" } },
              { supplier: { displayName: { contains: options.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.vendorCredit.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, supplierNumber: true, displayName: true },
          },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.vendorCredit.count({ where }),
    ]);

    return { items, total };
  }
}
