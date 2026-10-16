import { parsePagination } from "@/lib/validation/query";
import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { CustomerService } from "@/server/services/CustomerService";
import { CustomerSchema } from "@/lib/validation/master_data";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const status = (searchParams.get("status") as any) || undefined;
    const { skip, take } = parsePagination(searchParams);

    const result = await CustomerService.list(user, { search, status, skip, take });
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
    const validated = CustomerSchema.parse(body);

    const customer = await CustomerService.create(user, validated);
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
