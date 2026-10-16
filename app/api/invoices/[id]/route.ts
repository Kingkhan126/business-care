import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { InvoiceService } from "@/server/services/InvoiceService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const invoice = await InvoiceService.getById(user, params.id);
    return NextResponse.json(invoice);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
