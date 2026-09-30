import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { MasterDataService } from "@/server/services/MasterDataService";
import { ProductCategorySchema } from "@/lib/validation/master_data";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const categories = await MasterDataService.listCategories(user);
    return NextResponse.json(categories);
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
    const validated = ProductCategorySchema.parse(body);

    const category = await MasterDataService.createCategory(user, validated);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
