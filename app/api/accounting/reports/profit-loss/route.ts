import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { FinancialReportService } from "@/server/services/FinancialReportService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    const startDate = startDateStr ? new Date(startDateStr) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    const report = await FinancialReportService.getProfitAndLoss(user, { startDate, endDate });

    const formattedReport = {
      revenue: {
        total: report.totalRevenue,
        lines: report.revenueAccounts,
      },
      costOfGoodsSold: {
        total: report.totalCogs,
        lines: report.cogsAccounts,
      },
      grossProfit: report.grossProfit,
      operatingExpenses: {
        total: report.totalExpenses,
        lines: report.expenseAccounts,
      },
      netProfit: report.netProfit,
    };

    return NextResponse.json({ success: true, data: formattedReport });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
