import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { InventoryService } from "@/server/services/InventoryService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get("warehouseId") || undefined;
    const productId = searchParams.get("productId") || undefined;
    const search = searchParams.get("search") || undefined;
    const type = searchParams.get("type");

    if (type === "adjustments") {
      const result = await InventoryService.listStockAdjustments(user, { warehouseId, productId });
      return NextResponse.json(result);
    }

    const result = await InventoryService.listStockBalances(user, { warehouseId, productId, search });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
