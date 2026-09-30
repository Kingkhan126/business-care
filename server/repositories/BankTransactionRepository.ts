import { db } from "@/db/client";
import {
  Prisma,
  BankTransactionType,
  BankTransactionStatus,
  BankTransactionSource,
} from "@prisma/client";

export class BankTransactionRepository {
  static async listByOrg(
    organizationId: string,
    options?: {
      bankAccountId?: string;
      status?: BankTransactionStatus;
      transactionType?: BankTransactionType;
      source?: BankTransactionSource;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.BankTransactionWhereInput = {
      organizationId,
      ...(options?.bankAccountId && { bankAccountId: options.bankAccountId }),
      ...(options?.status && { status: options.status }),
      ...(options?.transactionType && { transactionType: options.transactionType }),
      ...(options?.source && { source: options.source }),
      ...((options?.startDate || options?.endDate) && {
        transactionDate: {
          ...(options?.startDate && { gte: options.startDate }),
          ...(options?.endDate && { lte: options.endDate }),
        },
      }),
      ...(options?.search && {
        OR: [
          { description: { contains: options.search, mode: "insensitive" } },
          { reference: { contains: options.search, mode: "insensitive" } },
          { payee: { contains: options.search, mode: "insensitive" } },
          { category: { contains: options.search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      db.bankTransaction.findMany({
        where,
        include: {
          bankAccount: true,
          matchedCustomerPayment: {
            include: { customer: true },
          },
          matchedVendorPayment: {
            include: { supplier: true },
          },
          matchedJournalEntry: true,
          reconciliation: true,
        },
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        skip: options?.skip ?? 0,
        take: options?.take ?? 100,
      }),
      db.bankTransaction.count({ where }),
    ]);

    return { items, total };
  }

  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.bankTransaction.findFirst({
      where: { id, organizationId },
      include: {
        bankAccount: {
          include: { linkedLedgerAccount: true },
        },
        matchedCustomerPayment: {
          include: { customer: true },
        },
        matchedVendorPayment: {
          include: { supplier: true },
        },
        matchedJournalEntry: true,
        reconciliation: true,
      },
    });
  }

  static async findByFingerprint(organizationId: string, fingerprint: string) {
    return db.bankTransaction.findFirst({
      where: { organizationId, fingerprint },
    });
  }

  static async findExistingFingerprints(
    organizationId: string,
    fingerprints: string[]
  ): Promise<Set<string>> {
    if (fingerprints.length === 0) return new Set();

    const existing = await db.bankTransaction.findMany({
      where: {
        organizationId,
        fingerprint: { in: fingerprints },
      },
      select: { fingerprint: true },
    });

    return new Set(existing.map((e) => e.fingerprint).filter((f): f is string => Boolean(f)));
  }

  static async create(data: Prisma.BankTransactionCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    return client.bankTransaction.create({
      data,
      include: {
        bankAccount: true,
      },
    });
  }

  static async createMany(
    data: Prisma.BankTransactionCreateManyInput[],
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || db;
    return client.bankTransaction.createMany({
      data,
    });
  }

  static async update(
    id: string,
    organizationId: string,
    data: Prisma.BankTransactionUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || db;
    return client.bankTransaction.update({
      where: { id },
      data,
      include: {
        bankAccount: true,
        matchedCustomerPayment: true,
        matchedVendorPayment: true,
        matchedJournalEntry: true,
      },
    });
  }

  static async updateStatus(
    id: string,
    status: BankTransactionStatus,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || db;
    return client.bankTransaction.update({
      where: { id },
      data: { status },
    });
  }

  static async countByStatus(organizationId: string, bankAccountId?: string) {
    const where: Prisma.BankTransactionWhereInput = {
      organizationId,
      ...(bankAccountId && { bankAccountId }),
    };

    const counts = await db.bankTransaction.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });

    const result: Record<string, number> = {
      UNMATCHED: 0,
      MATCHED: 0,
      RECONCILED: 0,
      VOIDED: 0,
    };

    for (const c of counts) {
      result[c.status] = c._count._all;
    }

    return result;
  }
}
