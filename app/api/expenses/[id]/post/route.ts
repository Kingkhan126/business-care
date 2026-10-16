import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { ExpensePostingService } from "@/server/services/ExpensePostingService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const journal = await ExpensePostingService.postExpense(user, params.id);
    return NextResponse.json({ success: true, data: journal });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
