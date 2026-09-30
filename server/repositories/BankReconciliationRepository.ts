import { db } from "@/db/client";
import { Prisma, ReconciliationStatus } from "@prisma/client";

export class BankReconciliationRepository {
  static async listByOrg(
    organizationId: string,
    options?: {
      bankAccountId?: string;
      status?: ReconciliationStatus;
      startDate?: Date;
      endDate?: Date;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.BankReconciliationWhereInput = {
      organizationId,
      ...(options?.bankAccountId && { bankAccountId: options.bankAccountId }),
      ...(options?.status && { status: options.status }),
      ...((options?.startDate || options?.endDate) && {
        statementEndDate: {
          ...(options?.startDate && { gte: options.startDate }),
          ...(options?.endDate && { lte: options.endDate }),
        },
      }),
    };

    const [items, total] = await Promise.all([
      db.bankReconciliation.findMany({
        where,
        include: {
          bankAccount: true,
          _count: {
            select: { items: true },
          },
        },
        orderBy: { statementEndDate: "desc" },
        skip: options?.skip ?? 0,
        take: options?.take ?? 50,
      }),
      db.bankReconciliation.count({ where }),
    ]);

    return { items, total };
  }

  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.bankReconciliation.findFirst({
      where: { id, organizationId },
      include: {
        bankAccount: {
          include: { linkedLedgerAccount: true },
        },
        items: {
          include: {
            bankTransaction: true,
          },
          orderBy: {
            bankTransaction: { transactionDate: "asc" },
          },
        },
      },
    });
  }

  static async findLatestCompleted(bankAccountId: string, organizationId: string) {
    return db.bankReconciliation.findFirst({
      where: {
        bankAccountId,
        organizationId,
        status: "COMPLETED",
      },
      orderBy: { statementEndDate: "desc" },
    });
  }

  static async findOpenByAccount(bankAccountId: string, organizationId: string) {
    return db.bankReconciliation.findFirst({
      where: {
        bankAccountId,
        organizationId,
        status: "OPEN",
      },
      include: {
        items: {
          include: { bankTransaction: true },
        },
      },
    });
  }

  static async findNextReconciliationNumber(organizationId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const count = await db.bankReconciliation.count({
      where: {
        organizationId,
        statementEndDate: {
          gte: new Date(`${currentYear}-01-01`),
          lte: new Date(`${currentYear}-12-31T23:59:59.999Z`),
        },
      },
    });

    const sequence = String(count + 1).padStart(5, "0");
    return `REC-${currentYear}-${sequence}`;
  }

  static async create(data: Prisma.BankReconciliationCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    return client.bankReconciliation.create({
      data,
      include: {
        bankAccount: true,
        items: {
          include: { bankTransaction: true },
        },
      },
    });
  }

  static async update(
    id: string,
    organizationId: string,
    data: Prisma.BankReconciliationUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || db;
    return client.bankReconciliation.update({
      where: { id },
      data,
      include: {
        bankAccount: true,
        items: {
          include: { bankTransaction: true },
        },
      },
    });
  }

  static async updateItem(
    id: string,
    data: Prisma.BankReconciliationItemUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || db;
    return client.bankReconciliationItem.update({
      where: { id },
      data,
    });
  }
}
