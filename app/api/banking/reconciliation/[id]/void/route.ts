import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { BankReconciliationService } from "@/server/services/BankReconciliationService";
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

    const voided = await BankReconciliationService.voidReconciliation(user, params.id, reason);
    return NextResponse.json({ success: true, data: voided });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
