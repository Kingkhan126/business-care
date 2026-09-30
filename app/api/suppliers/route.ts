import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { SupplierService } from "@/server/services/SupplierService";
import { SupplierSchema } from "@/lib/validation/master_data";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const status = (searchParams.get("status") as any) || undefined;
    const skip = searchParams.get("skip") ? parseInt(searchParams.get("skip")!, 10) : undefined;
    const take = searchParams.get("take") ? parseInt(searchParams.get("take")!, 10) : undefined;

    const result = await SupplierService.list(user, { search, status, skip, take });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Supplier GET Error]:", error);
    if (error instanceof AppError || (error && typeof error === "object" && "statusCode" in error)) {
      const appErr = error as AppError;
      return NextResponse.json({ error: appErr.message, code: appErr.code }, { status: appErr.statusCode || 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const validated = SupplierSchema.parse(body);

    const supplier = await SupplierService.create(user, validated);
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("[Supplier POST Error]:", error);
    if (error instanceof z.ZodError) {
      const message = error.errors.map((e) => e.message).join(", ");
      return NextResponse.json({ error: message, code: "VALIDATION_ERROR" }, { status: 400 });
    }
    if (error instanceof AppError || (error && typeof error === "object" && "statusCode" in error)) {
      const appErr = error as AppError;
      return NextResponse.json({ error: appErr.message, code: appErr.code }, { status: appErr.statusCode || 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
