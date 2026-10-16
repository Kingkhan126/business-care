import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { ExpenseApprovalService } from "@/server/services/ExpenseApprovalService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const approved = await ExpenseApprovalService.approve(user, params.id);
    return NextResponse.json({ success: true, data: approved });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
