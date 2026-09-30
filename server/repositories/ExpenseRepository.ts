import { db } from "@/db/client";
import { Prisma, ExpenseStatus, ExpenseType, ExpensePaymentType } from "@prisma/client";

type DatabaseClient = Prisma.TransactionClient | typeof db;

export class ExpenseRepository {
  static async create(data: Prisma.ExpenseCreateInput, tx?: DatabaseClient) {
    const client = tx || db;
    return client.expense.create({
      data,
      include: {
        category: true,
        supplier: true,
        claimant: { select: { id: true, name: true, email: true } },
        bankAccount: true,
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        lines: {
          include: {
            category: true,
          },
        },
        attachments: true,
        journalEntry: true,
        reimbursementJournal: true,
      },
    });
  }

  static async findByIdAndOrg(id: string, organizationId: string, tx?: DatabaseClient) {
    const client = tx || db;
    return client.expense.findFirst({
      where: { id, organizationId },
      include: {
        category: true,
        supplier: true,
        claimant: { select: { id: true, name: true, email: true } },
        bankAccount: {
          include: {
            linkedLedgerAccount: true,
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        lines: {
          include: {
            category: {
              include: {
                linkedExpenseAccount: true,
              },
            },
          },
        },
        attachments: {
          include: {
            uploadedBy: { select: { id: true, name: true, email: true } },
          },
        },
        journalEntry: {
          include: {
            lines: {
              include: { account: true },
            },
          },
        },
        reimbursementJournal: {
          include: {
            lines: {
              include: { account: true },
            },
          },
        },
      },
    });
  }

  static async findByNumberAndOrg(expenseNumber: string, organizationId: string, tx?: DatabaseClient) {
    const client = tx || db;
    return client.expense.findUnique({
      where: {
        organizationId_expenseNumber: {
          organizationId,
          expenseNumber,
        },
      },
      include: {
        category: true,
        supplier: true,
        claimant: { select: { id: true, name: true, email: true } },
        lines: true,
      },
    });
  }

  static async listByOrg(
    organizationId: string,
    options?: {
      status?: ExpenseStatus;
      expenseType?: ExpenseType;
      paymentType?: ExpensePaymentType;
      claimantId?: string;
      supplierId?: string;
      categoryId?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      skip?: number;
      take?: number;
    },
    tx?: DatabaseClient
  ) {
    const client = tx || db;
    const where: Prisma.ExpenseWhereInput = {
      organizationId,
      ...(options?.status && { status: options.status }),
      ...(options?.expenseType && { expenseType: options.expenseType }),
      ...(options?.paymentType && { paymentType: options.paymentType }),
      ...(options?.claimantId && { claimantId: options.claimantId }),
      ...(options?.supplierId && { supplierId: options.supplierId }),
      ...(options?.categoryId && { categoryId: options.categoryId }),
      ...((options?.startDate || options?.endDate) && {
        expenseDate: {
          ...(options?.startDate && { gte: options.startDate }),
          ...(options?.endDate && { lte: options.endDate }),
        },
      }),
      ...(options?.search && {
        OR: [
          { expenseNumber: { contains: options.search, mode: "insensitive" } },
          { description: { contains: options.search, mode: "insensitive" } },
          { notes: { contains: options.search, mode: "insensitive" } },
          { claimant: { name: { contains: options.search, mode: "insensitive" } } },
          { supplier: { displayName: { contains: options.search, mode: "insensitive" } } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      client.expense.findMany({
        where,
        include: {
          category: true,
          supplier: { select: { id: true, displayName: true } },
          claimant: { select: { id: true, name: true, email: true } },
          bankAccount: { select: { id: true, accountName: true } },
          createdBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          _count: {
            select: { lines: true, attachments: true },
          },
        },
        orderBy: { expenseDate: "desc" },
        skip: options?.skip ?? 0,
        take: options?.take ?? 50,
      }),
      client.expense.count({ where }),
    ]);

    return { items, total };
  }

  static async update(
    id: string,
    organizationId: string,
    data: Prisma.ExpenseUpdateInput,
    tx?: DatabaseClient
  ) {
    const client = tx || db;
    return client.expense.update({
      where: { id },
      data,
      include: {
        category: true,
        supplier: true,
        claimant: { select: { id: true, name: true, email: true } },
        bankAccount: true,
        lines: {
          include: { category: true },
        },
        attachments: true,
      },
    });
  }

  static async deleteDraft(id: string, organizationId: string, tx?: DatabaseClient) {
    const client = tx || db;
    return client.expense.delete({
      where: { id },
    });
  }

  static async findAttachments(expenseId: string, organizationId: string, tx?: DatabaseClient) {
    const client = tx || db;
    return client.expenseAttachment.findMany({
      where: { expenseId, organizationId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getSummaryMetrics(organizationId: string, tx?: DatabaseClient) {
    const client = tx || db;
    const [
      totalCount,
      pendingApprovalCount,
      approvedCount,
      postedCount,
      paidCount,
      reimbursementsDueCount,
      aggregates,
    ] = await Promise.all([
      client.expense.count({ where: { organizationId } }),
      client.expense.count({ where: { organizationId, status: "SUBMITTED" } }),
      client.expense.count({ where: { organizationId, status: "APPROVED" } }),
      client.expense.count({ where: { organizationId, status: "POSTED" } }),
      client.expense.count({ where: { organizationId, status: "PAID" } }),
      client.expense.count({
        where: {
          organizationId,
          expenseType: "EMPLOYEE_CLAIM",
          status: "POSTED",
        },
      }),
      client.expense.aggregate({
        where: {
          organizationId,
          status: { in: ["POSTED", "PAID"] },
        },
        _sum: {
          subtotal: true,
          taxTotal: true,
          total: true,
        },
      }),
    ]);

    return {
      totalCount,
      pendingApprovalCount,
      approvedCount,
      postedCount,
      paidCount,
      reimbursementsDueCount,
      totalAmount: Number(aggregates._sum.total || 0),
      totalSubtotal: Number(aggregates._sum.subtotal || 0),
      totalTax: Number(aggregates._sum.taxTotal || 0),
    };
  }
}
