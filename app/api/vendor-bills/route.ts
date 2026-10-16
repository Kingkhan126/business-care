import { parsePagination } from "@/lib/validation/query";
import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { VendorBillService } from "@/server/services/VendorBillService";
import { VendorBillSchema } from "@/lib/validation/transactions";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId") || undefined;
    const status = (searchParams.get("status") as any) || undefined;
    const search = searchParams.get("search") || undefined;
    const { skip, take } = parsePagination(searchParams);

    const result = await VendorBillService.list(user, { supplierId, status, search, skip, take });
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
    const validated = VendorBillSchema.parse(body);

    const bill = await VendorBillService.create(user, validated);
    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
