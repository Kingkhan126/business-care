import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { VendorBillService } from "@/server/services/VendorBillService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const bill = await VendorBillService.getById(user, params.id);
    return NextResponse.json(bill);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
