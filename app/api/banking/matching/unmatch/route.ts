import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { BankMatchingService } from "@/server/services/BankMatchingService";
import { UnmatchTransactionSchema } from "@/lib/validation/banking";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const validated = UnmatchTransactionSchema.parse(body);

    const result = await BankMatchingService.unmatchTransaction(user, validated.bankTransactionId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
