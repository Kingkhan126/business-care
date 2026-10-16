import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { ExpensePaymentService } from "@/server/services/ExpensePaymentService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json().catch(() => ({}));
    const reason = body?.reason || undefined;

    const voided = await ExpensePaymentService.voidExpense(user, params.id, reason);
    return NextResponse.json({ success: true, data: voided });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
