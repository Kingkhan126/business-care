import { db } from "@/db/client";
import { Prisma } from "@prisma/client";
import { SessionUser } from "@/types/auth";
import { hasPermission } from "../authorization/permissions";
import { NotFoundError } from "@/lib/errors";
import { CalculationEngine } from "./CalculationEngine";

const money = (value: Prisma.Decimal | null | undefined) => Number(value || 0);

export class DashboardService {
  static async getSummary(user: SessionUser, now = new Date()) {
    if (!user.activeOrganizationId) throw new NotFoundError("No active organization selected");
    const organizationId = user.activeOrganizationId;
    const organization = await db.organization.findUnique({
      where: { id: organizationId }, select: { name: true, currency: true, timezone: true },
    });
    if (!organization) throw new NotFoundError("Organization not found");
    const { currency } = organization;
    const access = {
      reports: hasPermission(user, "reports.read"),
      invoices: hasPermission(user, "invoices.read"),
      expenses: hasPermission(user, "expense.read"),
      banking: hasPermission(user, "banking.read"),
    };
    const ledgerWhere: Prisma.JournalEntryWhereInput = {
      organizationId, status: { in: ["POSTED", "REVERSED"] }, entryDate: { lte: now },
    };
    const ledgerTotal = (accountType: "REVENUE" | "EXPENSE") => db.journalEntryLine.aggregate({
      where: { journalEntry: ledgerWhere, account: { organizationId, accountType } },
      _sum: { debit: true, credit: true },
    });
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const [revenue, expense, receivables, unpaidExpenses, cash, accounts, invoices, expenses, timeline] = await Promise.all([
      access.reports ? ledgerTotal("REVENUE") : null,
      access.reports ? ledgerTotal("EXPENSE") : null,
      access.invoices ? db.salesInvoice.aggregate({
        where: { organizationId, currency, status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, _sum: { balanceDue: true },
      }) : null,
      access.expenses ? db.expense.aggregate({
        where: { organizationId, currency, status: { in: ["APPROVED", "POSTED"] }, paymentType: { in: ["ON_ACCOUNT", "REIMBURSEMENT"] } },
        _sum: { total: true },
      }) : null,
      access.banking ? db.bankAccount.aggregate({
        where: { organizationId, currency, isActive: true }, _sum: { currentBalance: true },
      }) : null,
      access.banking ? db.bankAccount.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, accountName: true, institutionName: true, accountNumberMasked: true, currentBalance: true, currency: true, isActive: true },
        orderBy: { accountName: "asc" }, take: 20,
      }) : [],
      access.invoices ? db.salesInvoice.findMany({
        where: { organizationId, currency, status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } },
        select: { id: true, invoiceNumber: true, total: true, status: true, issueDate: true, customer: { select: { displayName: true } } },
        orderBy: { issueDate: "desc" }, take: 5,
      }) : [],
      access.expenses ? db.expense.findMany({
        where: { organizationId, currency, status: { in: ["POSTED", "PAID"] } },
        select: { id: true, expenseNumber: true, total: true, status: true, expenseDate: true, category: { select: { name: true } } },
        orderBy: { expenseDate: "desc" }, take: 5,
      }) : [],
      access.reports ? db.$queryRaw<Array<{ month: Date; revenue: Prisma.Decimal; expenses: Prisma.Decimal }>>(Prisma.sql`
        SELECT date_trunc('month', j."entryDate") AS month,
          COALESCE(SUM(CASE WHEN a."accountType" = 'REVENUE' THEN l.credit - l.debit ELSE 0 END), 0) AS revenue,
          COALESCE(SUM(CASE WHEN a."accountType" = 'EXPENSE' THEN l.debit - l.credit ELSE 0 END), 0) AS expenses
        FROM "JournalEntryLine" l
        JOIN "JournalEntry" j ON j.id = l."journalEntryId"
        JOIN "Account" a ON a.id = l."accountId"
        WHERE j."organizationId" = ${organizationId} AND a."organizationId" = ${organizationId}
          AND j.status IN ('POSTED', 'REVERSED') AND j."entryDate" >= ${start} AND j."entryDate" <= ${now}
        GROUP BY date_trunc('month', j."entryDate") ORDER BY month
      `) : [],
    ]);
    const totalRevenue = CalculationEngine.roundMoney(money(revenue?._sum.credit) - money(revenue?._sum.debit));
    const totalExpenses = CalculationEngine.roundMoney(money(expense?._sum.debit) - money(expense?._sum.credit));
    return {
      organization, access, totalRevenue, totalExpenses,
      netProfit: CalculationEngine.roundMoney(totalRevenue - totalExpenses),
      receivables: money(receivables?._sum.balanceDue), unpaidExpenses: money(unpaidExpenses?._sum.total),
      cash: money(cash?._sum.currentBalance),
      accounts: accounts.map(a => ({ ...a, currentBalance: money(a.currentBalance) })),
      invoices, expenses,
      monthlyData: Array.from({ length: 6 }, (_, index) => {
        const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
        const row = timeline.find(r => new Date(r.month).getTime() === date.getTime());
        return { label: date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }), fullLabel: date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }), revenue: money(row?.revenue), expenses: money(row?.expenses) };
      }),
    };
  }
}
