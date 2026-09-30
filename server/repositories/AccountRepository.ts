import { db } from "@/db/client";
import { Prisma, AccountType } from "@prisma/client";

export class AccountRepository {
  static async listByOrg(
    organizationId: string,
    options?: {
      accountType?: AccountType;
      search?: string;
      isActive?: boolean;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.AccountWhereInput = {
      organizationId,
      ...(options?.accountType && { accountType: options.accountType }),
      ...(options?.isActive !== undefined && { isActive: options.isActive }),
      ...(options?.search && {
        OR: [
          { accountCode: { contains: options.search, mode: "insensitive" } },
          { accountName: { contains: options.search, mode: "insensitive" } },
          { description: { contains: options.search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      db.account.findMany({
        where,
        include: { parent: true },
        orderBy: { accountCode: "asc" },
        skip: options?.skip ?? 0,
        take: options?.take ?? 1000,
      }),
      db.account.count({ where }),
    ]);

    return { items, total };
  }

  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.account.findFirst({
      where: { id, organizationId },
      include: { parent: true, children: true },
    });
  }

  static async findByCodeAndOrg(accountCode: string, organizationId: string) {
    return db.account.findFirst({
      where: { accountCode, organizationId },
      include: { parent: true },
    });
  }

  static async countChildren(parentId: string) {
    return db.account.count({
      where: { parentId },
    });
  }
}
