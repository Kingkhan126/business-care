import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { PurchaseOrderService } from "@/server/services/PurchaseOrderService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const order = await PurchaseOrderService.getById(user, params.id);
    return NextResponse.json(order);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
