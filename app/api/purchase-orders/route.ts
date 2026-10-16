import { parsePagination } from "@/lib/validation/query";
import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { PurchaseOrderService } from "@/server/services/PurchaseOrderService";
import { PurchaseOrderSchema } from "@/lib/validation/transactions";
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

    const result = await PurchaseOrderService.list(user, { supplierId, status, search, skip, take });
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
    const validated = PurchaseOrderSchema.parse(body);

    const order = await PurchaseOrderService.create(user, validated);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
