import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { BankMatchingService } from "@/server/services/BankMatchingService";
import { MatchTransactionSchema } from "@/lib/validation/banking";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const validated = MatchTransactionSchema.parse(body);

    const result = await BankMatchingService.matchTransaction(user, validated);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
