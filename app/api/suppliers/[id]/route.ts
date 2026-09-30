import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { SupplierService } from "@/server/services/SupplierService";
import { SupplierSchema } from "@/lib/validation/master_data";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const supplier = await SupplierService.getById(user, params.id);
    return NextResponse.json(supplier);
  } catch (error) {
    console.error("[Supplier GET ById Error]:", error);
    if (error instanceof AppError || (error && typeof error === "object" && "statusCode" in error)) {
      const appErr = error as AppError;
      return NextResponse.json({ error: appErr.message, code: appErr.code }, { status: appErr.statusCode || 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const validated = SupplierSchema.partial().parse(body);

    const updated = await SupplierService.update(user, params.id, validated);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Supplier PUT Error]:", error);
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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    if (!body.status || !["ACTIVE", "INACTIVE"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const updated = await SupplierService.updateStatus(user, params.id, body.status);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Supplier PATCH Error]:", error);
    if (error instanceof AppError || (error && typeof error === "object" && "statusCode" in error)) {
      const appErr = error as AppError;
      return NextResponse.json({ error: appErr.message, code: appErr.code }, { status: appErr.statusCode || 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
