import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { BankAccountService } from "@/server/services/BankAccountService";
import { CreateBankAccountSchema } from "@/lib/validation/banking";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const accountType = (searchParams.get("accountType") as any) || undefined;
    const isActive = searchParams.get("isActive") ? searchParams.get("isActive") === "true" : undefined;

    const result = await BankAccountService.list(user, { search, accountType, isActive });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const validated = CreateBankAccountSchema.parse(body);

    const account = await BankAccountService.create(user, validated);
    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
