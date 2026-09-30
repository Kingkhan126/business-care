import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { BankAccountService } from "@/server/services/BankAccountService";
import { UpdateBankAccountSchema } from "@/lib/validation/banking";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const account = await BankAccountService.getById(user, params.id);
    return NextResponse.json({ success: true, data: account });
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
    const validated = UpdateBankAccountSchema.parse(body);

    const updated = await BankAccountService.update(user, params.id, validated);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const result = await BankAccountService.delete(user, params.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
