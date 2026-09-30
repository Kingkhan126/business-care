import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { BankTransactionService } from "@/server/services/BankTransactionService";
import { CategorizeTransactionSchema } from "@/lib/validation/banking";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const transaction = await BankTransactionService.getById(user, params.id);
    return NextResponse.json({ success: true, data: transaction });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const validated = CategorizeTransactionSchema.parse(body);

    const transaction = await BankTransactionService.categorize(user, params.id, validated);
    return NextResponse.json({ success: true, data: transaction });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
