import { db } from "@/db/client";
import { Prisma, CustomerStatus } from "@prisma/client";

export class CustomerRepository {
  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.customer.findFirst({
      where: { id, organizationId },
    });
  }

  static async findByNumberAndOrg(customerNumber: string, organizationId: string) {
    return db.customer.findFirst({
      where: { customerNumber, organizationId },
    });
  }

  static async listByOrg(
    organizationId: string,
    options?: {
      search?: string;
      status?: CustomerStatus;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.CustomerWhereInput = {
      organizationId,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search
        ? {
            OR: [
              { displayName: { contains: options.search, mode: "insensitive" } },
              { customerNumber: { contains: options.search, mode: "insensitive" } },
              { email: { contains: options.search, mode: "insensitive" } },
              { phone: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: options?.skip || 0,
        take: options?.take || 50,
      }),
      db.customer.count({ where }),
    ]);

    return { items, total };
  }

  static async create(data: Prisma.CustomerCreateInput) {
    return db.customer.create({ data });
  }

  static async update(id: string, organizationId: string, data: Prisma.CustomerUpdateInput) {
    return db.customer.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  static async countByOrg(organizationId: string): Promise<number> {
    return db.customer.count({ where: { organizationId } });
  }
}
