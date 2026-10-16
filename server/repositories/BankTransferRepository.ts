import { db } from "@/db/client";
import { Prisma, BankTransferStatus } from "@prisma/client";

export class BankTransferRepository {
  static async listByOrg(
    organizationId: string,
    options?: {
      status?: BankTransferStatus;
      bankAccountId?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.BankTransferWhereInput = {
      organizationId,
      ...(options?.status && { status: options.status }),
      ...(options?.bankAccountId && {
        OR: [
          { fromBankAccountId: options.bankAccountId },
          { toBankAccountId: options.bankAccountId },
        ],
      }),
      ...((options?.startDate || options?.endDate) && {
        transferDate: {
          ...(options?.startDate && { gte: options.startDate }),
          ...(options?.endDate && { lte: options.endDate }),
        },
      }),
      ...(options?.search && {
        OR: [
          { transferNumber: { contains: options.search, mode: "insensitive" } },
          { reference: { contains: options.search, mode: "insensitive" } },
          { memo: { contains: options.search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      db.bankTransfer.findMany({
        where,
        include: {
          fromBankAccount: true,
          toBankAccount: true,
          journalEntry: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { transferDate: "desc" },
        skip: options?.skip ?? 0,
        take: options?.take ?? 50,
      }),
      db.bankTransfer.count({ where }),
    ]);

    return { items, total };
  }

  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.bankTransfer.findFirst({
      where: { id, organizationId },
      include: {
        fromBankAccount: true,
        toBankAccount: true,
        journalEntry: {
          include: {
            lines: {
              include: { account: true },
            },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  static async create(data: Prisma.BankTransferCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx || db;
    return client.bankTransfer.create({
      data,
      include: {
        fromBankAccount: true,
        toBankAccount: true,
        journalEntry: true,
      },
    });
  }

  static async findByIdempotency(organizationId: string, idempotencyKey: string) {
    return db.bankTransfer.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId,
          idempotencyKey,
        },
      },
      include: {
        fromBankAccount: true,
        toBankAccount: true,
        journalEntry: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
