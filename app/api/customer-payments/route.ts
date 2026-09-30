import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { CustomerPaymentService } from "@/server/services/CustomerPaymentService";
import { CustomerPaymentSchema } from "@/lib/validation/transactions";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId") || undefined;
    const search = searchParams.get("search") || undefined;
    const skip = searchParams.get("skip") ? parseInt(searchParams.get("skip")!, 10) : undefined;
    const take = searchParams.get("take") ? parseInt(searchParams.get("take")!, 10) : undefined;

    const result = await CustomerPaymentService.list(user, { customerId, search, skip, take });
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
    const validated = CustomerPaymentSchema.parse(body);

    const payment = await CustomerPaymentService.recordPayment(user, validated);
    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
