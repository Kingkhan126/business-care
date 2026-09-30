import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { FinancialReportService } from "@/server/services/FinancialReportService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || undefined;
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;

    const report = await FinancialReportService.getGeneralLedger(user, {
      accountId,
      startDate,
      endDate,
    });

    const singleReport = Array.isArray(report) && report.length === 1 ? report[0] : report;

    return NextResponse.json({ success: true, data: singleReport });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
