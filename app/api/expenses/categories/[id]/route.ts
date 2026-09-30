import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { ExpenseCategoryService } from "@/server/services/ExpenseCategoryService";
import { UpdateExpenseCategorySchema } from "@/lib/validation/expense";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const category = await ExpenseCategoryService.getCategoryById(user, params.id);
    return NextResponse.json(category);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();

    // Prevent mass assignment: ignore client-passed organizationId
    const { organizationId: _org, ...sanitizedBody } = body;

    const validated = UpdateExpenseCategorySchema.parse(sanitizedBody);
    const updated = await ExpenseCategoryService.updateCategory(user, params.id, validated);

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const deactivated = await ExpenseCategoryService.deactivateCategory(user, params.id);
    return NextResponse.json({ success: true, data: deactivated });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
