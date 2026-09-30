import { db } from "@/db/client";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError } from "@/lib/errors";
import { CalculationEngine } from "./CalculationEngine";

export class FinancialReportService {
  /**
   * Generates General Ledger report for a specific account or all accounts.
   */
  static async getGeneralLedger(
    user: SessionUser,
    options?: { accountId?: string; startDate?: Date; endDate?: Date }
  ) {
    if (!user.activeOrganizationId) throw new NotFoundError("No active organization selected");
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "accounting.read");

    const accounts = await db.account.findMany({
      where: {
        organizationId: user.activeOrganizationId,
        ...(options?.accountId && { id: options.accountId }),
      },
      orderBy: { accountCode: "asc" },
    });

    const report = [];

    for (const acc of accounts) {
      const lines = await db.journalEntryLine.findMany({
        where: {
          accountId: acc.id,
          journalEntry: {
            organizationId: user.activeOrganizationId,
            status: "POSTED",
            ...(options?.startDate && options?.endDate && {
              entryDate: { gte: options.startDate, lte: options.endDate },
            }),
          },
        },
        include: {
          journalEntry: {
            select: { id: true, journalNumber: true, entryDate: true, description: true, source: true },
          },
          customer: { select: { displayName: true } },
          supplier: { select: { displayName: true } },
        },
        orderBy: { journalEntry: { entryDate: "asc" } },
      });

      let runningBalance = 0;
      const formattedLines = lines.map((l) => {
        const debit = Number(l.debit);
        const credit = Number(l.credit);
        const netChange = acc.normalBalance === "DEBIT" ? debit - credit : credit - debit;
        runningBalance = CalculationEngine.roundMoney(runningBalance + netChange);

        return {
          id: l.id,
          journalNumber: l.journalEntry.journalNumber,
          entryDate: l.journalEntry.entryDate,
          description: l.description || l.journalEntry.description,
          source: l.journalEntry.source,
          debit,
          credit,
          runningBalance,
          partyName: l.customer?.displayName || l.supplier?.displayName || null,
        };
      });

      report.push({
        account: {
          id: acc.id,
          code: acc.accountCode,
          name: acc.accountName,
          type: acc.accountType,
          normalBalance: acc.normalBalance,
        },
        endingBalance: runningBalance,
        lines: formattedLines,
      });
    }

    return report;
  }

  /**
   * Generates Trial Balance report verifying Total Debits == Total Credits.
   */
  static async getTrialBalance(
    user: SessionUser,
    options?: { asOfDate?: Date; periodId?: string }
  ) {
    if (!user.activeOrganizationId) throw new NotFoundError("No active organization selected");
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "reports.read");

    const asOfDate = options?.asOfDate || new Date();

    const accounts = await db.account.findMany({
      where: { organizationId: user.activeOrganizationId, isActive: true },
      orderBy: { accountCode: "asc" },
    });

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    const rows = [];

    for (const acc of accounts) {
      const aggregates = await db.journalEntryLine.aggregate({
        where: {
          accountId: acc.id,
          journalEntry: {
            organizationId: user.activeOrganizationId,
            status: "POSTED",
            entryDate: { lte: asOfDate },
            ...(options?.periodId && { accountingPeriodId: options.periodId }),
          },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const totalDebitSum = Number(aggregates._sum.debit || 0);
      const totalCreditSum = Number(aggregates._sum.credit || 0);

      if (totalDebitSum > 0 || totalCreditSum > 0) {
        let debitBalance = 0;
        let creditBalance = 0;

        if (acc.normalBalance === "DEBIT") {
          const net = totalDebitSum - totalCreditSum;
          if (net >= 0) debitBalance = net;
          else creditBalance = Math.abs(net);
        } else {
          const net = totalCreditSum - totalDebitSum;
          if (net >= 0) creditBalance = net;
          else debitBalance = Math.abs(net);
        }

        grandTotalDebit = CalculationEngine.roundMoney(grandTotalDebit + debitBalance);
        grandTotalCredit = CalculationEngine.roundMoney(grandTotalCredit + creditBalance);

        rows.push({
          accountId: acc.id,
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          accountType: acc.accountType,
          debitBalance,
          creditBalance,
        });
      }
    }

    const isBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.01;

    return {
      asOfDate,
      rows,
      grandTotalDebit,
      grandTotalCredit,
      isBalanced,
    };
  }

  /**
   * Generates Profit & Loss Statement (Income Statement).
   */
  static async getProfitAndLoss(
    user: SessionUser,
    options?: { startDate?: Date; endDate?: Date }
  ) {
    if (!user.activeOrganizationId) throw new NotFoundError("No active organization selected");
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "reports.read");

    const startDate = options?.startDate || new Date(new Date().getFullYear(), 0, 1);
    const endDate = options?.endDate || new Date();

    const accounts = await db.account.findMany({
      where: {
        organizationId: user.activeOrganizationId,
        accountType: { in: ["REVENUE", "EXPENSE"] },
        isActive: true,
      },
      orderBy: { accountCode: "asc" },
    });

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalExpenses = 0;

    const revenueAccounts: any[] = [];
    const cogsAccounts: any[] = [];
    const expenseAccounts: any[] = [];

    for (const acc of accounts) {
      const aggregates = await db.journalEntryLine.aggregate({
        where: {
          accountId: acc.id,
          journalEntry: {
            organizationId: user.activeOrganizationId,
            status: "POSTED",
            entryDate: { gte: startDate, lte: endDate },
          },
        },
        _sum: { debit: true, credit: true },
      });

      const debit = Number(aggregates._sum.debit || 0);
      const credit = Number(aggregates._sum.credit || 0);

      if (acc.accountType === "REVENUE") {
        const netRevenue = CalculationEngine.roundMoney(credit - debit);
        if (netRevenue !== 0) {
          totalRevenue = CalculationEngine.roundMoney(totalRevenue + netRevenue);
          revenueAccounts.push({ code: acc.accountCode, name: acc.accountName, amount: netRevenue });
        }
      } else if (acc.accountType === "EXPENSE") {
        const netExpense = CalculationEngine.roundMoney(debit - credit);
        if (netExpense !== 0) {
          if (acc.accountCode.startsWith("5")) {
            totalCogs = CalculationEngine.roundMoney(totalCogs + netExpense);
            cogsAccounts.push({ code: acc.accountCode, name: acc.accountName, amount: netExpense });
          } else {
            totalExpenses = CalculationEngine.roundMoney(totalExpenses + netExpense);
            expenseAccounts.push({ code: acc.accountCode, name: acc.accountName, amount: netExpense });
          }
        }
      }
    }

    const grossProfit = CalculationEngine.roundMoney(totalRevenue - totalCogs);
    const netProfit = CalculationEngine.roundMoney(grossProfit - totalExpenses);

    return {
      startDate,
      endDate,
      totalRevenue,
      revenueAccounts,
      totalCogs,
      cogsAccounts,
      grossProfit,
      totalExpenses,
      expenseAccounts,
      netProfit,
    };
  }

  /**
   * Generates Balance Sheet Statement (Assets = Liabilities + Equity).
   */
  static async getBalanceSheet(
    user: SessionUser,
    options?: { asOfDate?: Date }
  ) {
    if (!user.activeOrganizationId) throw new NotFoundError("No active organization selected");
    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "reports.read");

    const asOfDate = options?.asOfDate || new Date();

    const accounts = await db.account.findMany({
      where: {
        organizationId: user.activeOrganizationId,
        accountType: { in: ["ASSET", "LIABILITY", "EQUITY"] },
        isActive: true,
      },
      orderBy: { accountCode: "asc" },
    });

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    const assetAccounts: any[] = [];
    const liabilityAccounts: any[] = [];
    const equityAccounts: any[] = [];

    for (const acc of accounts) {
      const aggregates = await db.journalEntryLine.aggregate({
        where: {
          accountId: acc.id,
          journalEntry: {
            organizationId: user.activeOrganizationId,
            status: "POSTED",
            entryDate: { lte: asOfDate },
          },
        },
        _sum: { debit: true, credit: true },
      });

      const debit = Number(aggregates._sum.debit || 0);
      const credit = Number(aggregates._sum.credit || 0);

      if (acc.accountType === "ASSET") {
        const netAsset = CalculationEngine.roundMoney(debit - credit);
        if (netAsset !== 0) {
          totalAssets = CalculationEngine.roundMoney(totalAssets + netAsset);
          assetAccounts.push({ code: acc.accountCode, name: acc.accountName, amount: netAsset });
        }
      } else if (acc.accountType === "LIABILITY") {
        const netLiability = CalculationEngine.roundMoney(credit - debit);
        if (netLiability !== 0) {
          totalLiabilities = CalculationEngine.roundMoney(totalLiabilities + netLiability);
          liabilityAccounts.push({ code: acc.accountCode, name: acc.accountName, amount: netLiability });
        }
      } else if (acc.accountType === "EQUITY") {
        const netEquity = CalculationEngine.roundMoney(credit - debit);
        if (netEquity !== 0) {
          totalEquity = CalculationEngine.roundMoney(totalEquity + netEquity);
          equityAccounts.push({ code: acc.accountCode, name: acc.accountName, amount: netEquity });
        }
      }
    }

    const currentFiscalYearStart = new Date(asOfDate.getFullYear(), 0, 1);

    // 1. Calculate Prior Period Retained Earnings (All REVENUE and EXPENSE posted lines before current fiscal year)
    const priorRevAgg = await db.journalEntryLine.aggregate({
      where: {
        account: { organizationId: user.activeOrganizationId, accountType: "REVENUE" },
        journalEntry: { organizationId: user.activeOrganizationId, status: "POSTED", entryDate: { lt: currentFiscalYearStart } },
      },
      _sum: { debit: true, credit: true },
    });

    const priorExpAgg = await db.journalEntryLine.aggregate({
      where: {
        account: { organizationId: user.activeOrganizationId, accountType: "EXPENSE" },
        journalEntry: { organizationId: user.activeOrganizationId, status: "POSTED", entryDate: { lt: currentFiscalYearStart } },
      },
      _sum: { debit: true, credit: true },
    });

    const priorRevNet = Number(priorRevAgg._sum.credit || 0) - Number(priorRevAgg._sum.debit || 0);
    const priorExpNet = Number(priorExpAgg._sum.debit || 0) - Number(priorExpAgg._sum.credit || 0);
    const priorPeriodRetainedEarnings = CalculationEngine.roundMoney(priorRevNet - priorExpNet);

    if (priorPeriodRetainedEarnings !== 0) {
      equityAccounts.push({
        code: "3998",
        name: "Prior Period Retained Earnings",
        amount: priorPeriodRetainedEarnings,
      });
      totalEquity = CalculationEngine.roundMoney(totalEquity + priorPeriodRetainedEarnings);
    }

    // 2. Calculate Current Period Net Earnings
    const pnl = await this.getProfitAndLoss(user, {
      startDate: currentFiscalYearStart,
      endDate: asOfDate,
    });

    if (pnl.netProfit !== 0) {
      equityAccounts.push({
        code: "9999",
        name: "Current Period Net Earnings",
        amount: pnl.netProfit,
      });
      totalEquity = CalculationEngine.roundMoney(totalEquity + pnl.netProfit);
    }

    const totalLiabilitiesAndEquity = CalculationEngine.roundMoney(totalLiabilities + totalEquity);
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

    return {
      asOfDate,
      totalAssets,
      assetAccounts,
      totalLiabilities,
      liabilityAccounts,
      totalEquity,
      equityAccounts,
      totalLiabilitiesAndEquity,
      isBalanced,
    };
  }
}
