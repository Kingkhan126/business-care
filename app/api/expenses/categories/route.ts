import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { ExpenseCategoryService } from "@/server/services/ExpenseCategoryService";
import { CreateExpenseCategorySchema } from "@/lib/validation/expense";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const isActive = includeInactive ? undefined : true;
    const search = searchParams.get("search") || undefined;

    const categories = await ExpenseCategoryService.listCategories(user, { isActive, search });
    return NextResponse.json(categories);
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

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();

    // Prevent mass assignment: ignore client-passed organizationId
    const { organizationId: _org, ...sanitizedBody } = body;

    const validated = CreateExpenseCategorySchema.parse(sanitizedBody);
    const category = await ExpenseCategoryService.createCategory(user, validated);

    return NextResponse.json(category, { status: 201 });
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
