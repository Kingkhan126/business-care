import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { BankReconciliationService } from "@/server/services/BankReconciliationService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const reconciliation = await BankReconciliationService.getById(user, params.id);
    return NextResponse.json({ success: true, data: reconciliation });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
