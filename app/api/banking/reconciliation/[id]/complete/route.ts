import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { BankReconciliationService } from "@/server/services/BankReconciliationService";
import { CompleteReconciliationSchema } from "@/lib/validation/banking";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json().catch(() => ({}));
    const validated = CompleteReconciliationSchema.parse(body);

    const completed = await BankReconciliationService.completeReconciliation(
      user,
      params.id,
      validated.notes
    );
    return NextResponse.json({ success: true, data: completed });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
