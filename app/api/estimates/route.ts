import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { EstimateService } from "@/server/services/EstimateService";
import { EstimateSchema } from "@/lib/validation/transactions";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId") || undefined;
    const status = (searchParams.get("status") as any) || undefined;
    const search = searchParams.get("search") || undefined;
    const skip = searchParams.get("skip") ? parseInt(searchParams.get("skip")!, 10) : undefined;
    const take = searchParams.get("take") ? parseInt(searchParams.get("take")!, 10) : undefined;

    const result = await EstimateService.list(user, { customerId, status, search, skip, take });
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
    const validated = EstimateSchema.parse(body);

    const estimate = await EstimateService.create(user, validated);
    return NextResponse.json(estimate, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
