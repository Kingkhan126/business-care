import { db } from "@/db/client";
import { Prisma, BillStatus } from "@prisma/client";

export class VendorBillRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.vendorBill.findFirst({
      where: { id, organizationId },
      include: {
        supplier: true,
        sourcePurchaseOrder: true,
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

  static async findByNumberAndOrg(billNumber: string, organizationId: string) {
    return db.vendorBill.findFirst({
      where: { billNumber, organizationId },
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
      status?: BillStatus;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.VendorBillWhereInput = {
      organizationId,
      ...(options?.supplierId ? { supplierId: options.supplierId } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search
        ? {
            OR: [
              { billNumber: { contains: options.search, mode: "insensitive" } },
              { vendorBillReference: { contains: options.search, mode: "insensitive" } },
              { supplier: { displayName: { contains: options.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.vendorBill.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, supplierNumber: true, displayName: true, email: true },
          },
          _count: { select: { lines: true, paymentAllocations: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.vendorBill.count({ where }),
    ]);

    return { items, total };
  }
}
