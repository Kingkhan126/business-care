import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { ExpenseService } from "@/server/services/ExpenseService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const filters = {
      startDate: searchParams.get("startDate") || searchParams.get("dateFrom") || undefined,
      endDate: searchParams.get("endDate") || searchParams.get("dateTo") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      status: (searchParams.get("status") as any) || undefined,
      expenseType: (searchParams.get("expenseType") as any) || undefined,
      claimantId: searchParams.get("claimantId") || undefined,
    };

    const report = await ExpenseService.getExpenseReports(user, filters);
    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
