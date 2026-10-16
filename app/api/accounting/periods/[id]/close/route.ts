import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { AccountingPeriodService } from "@/server/services/AccountingPeriodService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const period = await AccountingPeriodService.closePeriod(user, params.id);

    return NextResponse.json({ success: true, data: period });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
