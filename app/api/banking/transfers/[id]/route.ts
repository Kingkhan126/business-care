import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { BankTransferService } from "@/server/services/BankTransferService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const transfer = await BankTransferService.getById(user, params.id);
    return NextResponse.json({ success: true, data: transfer });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
