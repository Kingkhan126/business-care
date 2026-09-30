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

    const report = await FinancialReportService.getTrialBalance(user, { asOfDate });

    // Format fields for frontend UI
    const formattedReport = {
      isBalanced: report.isBalanced,
      totalDebits: report.grandTotalDebit,
      totalCredits: report.grandTotalCredit,
      lines: report.rows.map((r) => ({
        accountId: r.accountId,
        code: r.accountCode,
        name: r.accountName,
        type: r.accountType,
        debit: r.debitBalance,
        credit: r.creditBalance,
      })),
    };

    return NextResponse.json({ success: true, data: formattedReport });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
