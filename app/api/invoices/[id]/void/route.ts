import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { InvoiceService } from "@/server/services/InvoiceService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const voided = await InvoiceService.voidInvoice(user, params.id);
    return NextResponse.json(voided);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
