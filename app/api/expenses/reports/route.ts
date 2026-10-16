import { apiErrorResponse } from "@/lib/errors/http";
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
    return apiErrorResponse(error);
  }
}
