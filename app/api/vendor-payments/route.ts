import { parsePagination } from "@/lib/validation/query";
import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { VendorPaymentService } from "@/server/services/VendorPaymentService";
import { VendorPaymentSchema } from "@/lib/validation/transactions";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId") || undefined;
    const search = searchParams.get("search") || undefined;
    const { skip, take } = parsePagination(searchParams);

    const result = await VendorPaymentService.list(user, { supplierId, search, skip, take });
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
    const validated = VendorPaymentSchema.parse(body);

    const payment = await VendorPaymentService.recordPayment(user, validated);
    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
