import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { SalesOrderService } from "@/server/services/SalesOrderService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json().catch(() => ({}));
    const invoice = await SalesOrderService.convertToInvoice(user, params.id, body.warehouseId);
    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
