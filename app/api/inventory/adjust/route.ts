import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { InventoryService } from "@/server/services/InventoryService";
import { StockAdjustmentSchema } from "@/lib/validation/master_data";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const validated = StockAdjustmentSchema.parse(body);

    const result = await InventoryService.adjustStock(user, validated);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
