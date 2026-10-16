import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { EstimateService } from "@/server/services/EstimateService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const estimate = await EstimateService.getById(user, params.id);
    return NextResponse.json(estimate);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const updated = await EstimateService.updateStatus(user, params.id, body.status);
    return NextResponse.json(updated);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
