import { parsePagination } from "@/lib/validation/query";
import { apiErrorResponse } from "@/lib/errors/http";
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
    const { skip, take } = parsePagination(searchParams);

    const result = await CustomerPaymentService.list(user, { customerId, search, skip, take });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
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
    return apiErrorResponse(error);
  }
}
