import { db } from "@/db/client";
import { Prisma } from "@prisma/client";

type DatabaseClient = Prisma.TransactionClient | typeof db;

export class ExpenseCategoryRepository {
  static async create(data: Prisma.ExpenseCategoryCreateInput, tx?: DatabaseClient) {
    const client = tx || db;
    return client.expenseCategory.create({
      data,
      include: {
        linkedExpenseAccount: true,
      },
    });
  }

  static async findByIdAndOrg(id: string, organizationId: string, tx?: DatabaseClient) {
    const client = tx || db;
    return client.expenseCategory.findFirst({
      where: { id, organizationId },
      include: {
        linkedExpenseAccount: true,
        _count: {
          select: { expenses: true, lines: true },
        },
      },
    });
  }

  static async findByCodeAndOrg(code: string, organizationId: string, tx?: DatabaseClient) {
    const client = tx || db;
    return client.expenseCategory.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code,
        },
      },
      include: {
        linkedExpenseAccount: true,
      },
    });
  }

  static async findByNameAndOrg(name: string, organizationId: string, tx?: DatabaseClient) {
    const client = tx || db;
    return client.expenseCategory.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name,
        },
      },
      include: {
        linkedExpenseAccount: true,
      },
    });
  }

  static async listByOrg(
    organizationId: string,
    options?: {
      isActive?: boolean;
      search?: string;
      skip?: number;
      take?: number;
    },
    tx?: DatabaseClient
  ) {
    const client = tx || db;
    const where: Prisma.ExpenseCategoryWhereInput = {
      organizationId,
      ...(options?.isActive !== undefined && { isActive: options.isActive }),
      ...(options?.search && {
        OR: [
          { name: { contains: options.search, mode: "insensitive" } },
          { code: { contains: options.search, mode: "insensitive" } },
          { description: { contains: options.search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      client.expenseCategory.findMany({
        where,
        include: {
          linkedExpenseAccount: true,
          _count: {
            select: { expenses: true, lines: true },
          },
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: options?.skip ?? 0,
        take: options?.take ?? 50,
      }),
      client.expenseCategory.count({ where }),
    ]);

    return { items, total };
  }

  static async update(
    id: string,
    organizationId: string,
    data: Prisma.ExpenseCategoryUpdateInput,
    tx?: DatabaseClient
  ) {
    const client = tx || db;
    return client.expenseCategory.update({
      where: { id },
      data,
      include: {
        linkedExpenseAccount: true,
      },
    });
  }

  static async deactivate(id: string, organizationId: string, tx?: DatabaseClient) {
    const client = tx || db;
    return client.expenseCategory.update({
      where: { id },
      data: { isActive: false },
      include: {
        linkedExpenseAccount: true,
      },
    });
  }

  static async hasExpenses(id: string, organizationId: string, tx?: DatabaseClient): Promise<boolean> {
    const client = tx || db;
    const [expenseCount, lineCount] = await Promise.all([
      client.expense.count({
        where: { organizationId, categoryId: id },
      }),
      client.expenseLine.count({
        where: { categoryId: id },
      }),
    ]);
    return expenseCount > 0 || lineCount > 0;
  }
}
