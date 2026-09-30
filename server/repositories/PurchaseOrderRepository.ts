import { db } from "@/db/client";
import { Prisma, PurchaseOrderStatus } from "@prisma/client";

export class PurchaseOrderRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: {
        supplier: true,
        lines: {
          include: {
            product: true,
            service: true,
          },
        },
      },
    });
  }

  static async findByNumberAndOrg(purchaseOrderNumber: string, organizationId: string) {
    return db.purchaseOrder.findFirst({
      where: { purchaseOrderNumber, organizationId },
      include: {
        supplier: true,
        lines: true,
      },
    });
  }

  static async listByOrg(
    organizationId: string,
    options?: {
      supplierId?: string;
      status?: PurchaseOrderStatus;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.PurchaseOrderWhereInput = {
      organizationId,
      ...(options?.supplierId ? { supplierId: options.supplierId } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search
        ? {
            OR: [
              { purchaseOrderNumber: { contains: options.search, mode: "insensitive" } },
              { supplier: { displayName: { contains: options.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, supplierNumber: true, displayName: true, email: true },
          },
          _count: { select: { lines: true, vendorBills: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.purchaseOrder.count({ where }),
    ]);

    return { items, total };
  }
}
