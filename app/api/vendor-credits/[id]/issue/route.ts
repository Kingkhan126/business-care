import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { VendorCreditService } from "@/server/services/VendorCreditService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const issued = await VendorCreditService.issueVendorCredit(user, params.id);
    return NextResponse.json(issued);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
