import { db } from "@/db/client";
import { Prisma, BankAccountType } from "@prisma/client";

export class BankAccountRepository {
  static async listByOrg(
    organizationId: string,
    options?: {
      accountType?: BankAccountType;
      isActive?: boolean;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.BankAccountWhereInput = {
      organizationId,
      ...(options?.accountType && { accountType: options.accountType }),
      ...(options?.isActive !== undefined && { isActive: options.isActive }),
      ...(options?.search && {
        OR: [
          { accountName: { contains: options.search, mode: "insensitive" } },
          { institutionName: { contains: options.search, mode: "insensitive" } },
          { accountNumberMasked: { contains: options.search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      db.bankAccount.findMany({
        where,
        include: {
          linkedLedgerAccount: true,
          _count: {
            select: {
              transactions: true,
              reconciliations: true,
            },
          },
        },
        orderBy: { accountName: "asc" },
        skip: options?.skip ?? 0,
        take: options?.take ?? 100,
      }),
      db.bankAccount.count({ where }),
    ]);

    return { items, total };
  }

  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.bankAccount.findFirst({
      where: { id, organizationId },
      include: {
        linkedLedgerAccount: true,
        _count: {
          select: {
            transactions: true,
            reconciliations: true,
          },
        },
      },
    });
  }

  static async findByNameAndOrg(accountName: string, organizationId: string) {
    return db.bankAccount.findFirst({
      where: {
        accountName: { equals: accountName, mode: "insensitive" },
        organizationId,
      },
    });
  }

  static async create(data: Prisma.BankAccountCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    return client.bankAccount.create({
      data,
      include: {
        linkedLedgerAccount: true,
      },
    });
  }

  static async update(
    id: string,
    organizationId: string,
    data: Prisma.BankAccountUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || db;
    return client.bankAccount.update({
      where: { id },
      data,
      include: {
        linkedLedgerAccount: true,
      },
    });
  }

  static async updateBalance(
    id: string,
    amountDelta: Prisma.Decimal | number,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || db;
    return client.bankAccount.update({
      where: { id },
      data: {
        currentBalance: {
          increment: amountDelta,
        },
      },
    });
  }

  static async countByOrg(organizationId: string) {
    return db.bankAccount.count({
      where: { organizationId },
    });
  }
}
