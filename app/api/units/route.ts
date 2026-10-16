import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { MasterDataService } from "@/server/services/MasterDataService";
import { UnitOfMeasureSchema } from "@/lib/validation/master_data";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const units = await MasterDataService.listUnitsOfMeasure(user);
    return NextResponse.json(units);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const validated = UnitOfMeasureSchema.parse(body);

    const unit = await MasterDataService.createUnitOfMeasure(user, validated);
    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
