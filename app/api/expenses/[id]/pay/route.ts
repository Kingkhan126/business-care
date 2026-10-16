import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { ExpensePaymentService } from "@/server/services/ExpensePaymentService";
import { PayExpenseSchema } from "@/lib/validation/expense";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const validated = PayExpenseSchema.parse(body);

    const paid = await ExpensePaymentService.payExpense(user, params.id, validated);
    return NextResponse.json({ success: true, data: paid });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
