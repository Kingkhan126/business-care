import { db } from "@/db/client";
import { Prisma } from "@prisma/client";

export class VendorPaymentRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.vendorPayment.findFirst({
      where: { id, organizationId },
      include: {
        supplier: true,
        allocations: {
          include: {
            bill: true,
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
    const where: Prisma.VendorPaymentWhereInput = {
      organizationId,
      ...(options?.supplierId ? { supplierId: options.supplierId } : {}),
      ...(options?.search
        ? {
            OR: [
              { paymentNumber: { contains: options.search, mode: "insensitive" } },
              { reference: { contains: options.search, mode: "insensitive" } },
              { supplier: { displayName: { contains: options.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.vendorPayment.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, supplierNumber: true, displayName: true },
          },
          allocations: {
            include: {
              bill: { select: { id: true, billNumber: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.vendorPayment.count({ where }),
    ]);

    return { items, total };
  }
}
