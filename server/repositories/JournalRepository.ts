import { db } from "@/db/client";
import { Prisma, JournalStatus, JournalSource } from "@prisma/client";

export class JournalRepository {
  static async listByOrg(
    organizationId: string,
    options?: {
      status?: JournalStatus;
      source?: JournalSource;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      skip?: number;
      take?: number;
    }
  ) {
    const where: Prisma.JournalEntryWhereInput = {
      organizationId,
      ...(options?.status && { status: options.status }),
      ...(options?.source && { source: options.source }),
      ...(options?.startDate && options?.endDate && {
        entryDate: {
          gte: options.startDate,
          lte: options.endDate,
        },
      }),
      ...(options?.search && {
        OR: [
          { journalNumber: { contains: options.search, mode: "insensitive" } },
          { description: { contains: options.search, mode: "insensitive" } },
          { referenceType: { contains: options.search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: true,
              customer: true,
              supplier: true,
              product: true,
            },
          },
          createdBy: { select: { id: true, name: true, email: true } },
          accountingPeriod: true,
        },
        orderBy: { entryDate: "desc" },
        skip: options?.skip ?? 0,
        take: options?.take ?? 50,
      }),
      db.journalEntry.count({ where }),
    ]);

    return { items, total };
  }

  static async findByIdAndOrg(id: string, organizationId: string) {
    return db.journalEntry.findFirst({
      where: { id, organizationId },
      include: {
        lines: {
          include: {
            account: true,
            customer: true,
            supplier: true,
            product: true,
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
        accountingPeriod: true,
        reversedEntry: true,
        reversingEntry: true,
      },
    });
  }
}
