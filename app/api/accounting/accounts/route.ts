import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { AccountService } from "@/server/services/AccountService";
import { AccountSchema } from "@/lib/validation/accounting";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const accountType = (searchParams.get("accountType") as any) || undefined;

    const result = await AccountService.list(user, { search, accountType });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const validated = AccountSchema.parse(body);

    const account = await AccountService.create(user, validated);
    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
