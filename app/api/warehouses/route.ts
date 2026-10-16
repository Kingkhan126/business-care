import { apiErrorResponse } from "@/lib/errors/http";
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
    return apiErrorResponse(error);
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
    return apiErrorResponse(error);
  }
}
