import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { FinancialReportService } from "@/server/services/FinancialReportService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const asOfDate = dateStr ? new Date(dateStr) : undefined;

    const report = await FinancialReportService.getBalanceSheet(user, { asOfDate });

    const formattedReport = {
      isBalanced: report.isBalanced,
      totalAssets: report.totalAssets,
      assets: {
        total: report.totalAssets,
        lines: report.assetAccounts,
      },
      totalLiabilities: report.totalLiabilities,
      liabilities: {
        total: report.totalLiabilities,
        lines: report.liabilityAccounts,
      },
      totalEquity: report.totalEquity,
      equity: {
        total: report.totalEquity,
        lines: report.equityAccounts.filter((e) => e.code !== "9999"),
        currentPeriodNetIncome: report.equityAccounts.find((e) => e.code === "9999")?.amount || 0,
      },
      totalLiabilitiesAndEquity: report.totalLiabilitiesAndEquity,
    };

    return NextResponse.json({ success: true, data: formattedReport });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
