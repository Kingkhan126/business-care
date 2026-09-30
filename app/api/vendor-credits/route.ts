import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { VendorCreditService } from "@/server/services/VendorCreditService";
import { VendorCreditSchema } from "@/lib/validation/transactions";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId") || undefined;
    const search = searchParams.get("search") || undefined;
    const skip = searchParams.get("skip") ? parseInt(searchParams.get("skip")!, 10) : undefined;
    const take = searchParams.get("take") ? parseInt(searchParams.get("take")!, 10) : undefined;

    const result = await VendorCreditService.list(user, { supplierId, search, skip, take });
    return NextResponse.json(result);
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
    const validated = VendorCreditSchema.parse(body);

    const vendorCredit = await VendorCreditService.create(user, validated);
    return NextResponse.json(vendorCredit, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
