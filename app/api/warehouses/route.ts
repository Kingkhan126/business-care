import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { MasterDataService } from "@/server/services/MasterDataService";
import { WarehouseSchema } from "@/lib/validation/master_data";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const warehouses = await MasterDataService.listWarehouses(user);
    return NextResponse.json(warehouses);
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
    const validated = WarehouseSchema.parse(body);

    const warehouse = await MasterDataService.createWarehouse(user, validated);
    return NextResponse.json(warehouse, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
