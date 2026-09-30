import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { EstimateService } from "@/server/services/EstimateService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    let targetType = "sales_order";
    let warehouseId: string | undefined = undefined;

    try {
      const body = await request.json();
      if (body?.targetType) targetType = body.targetType;
      if (body?.warehouseId) warehouseId = body.warehouseId;
    } catch {
      // Body optional
    }

    if (targetType === "invoice") {
      const invoice = await EstimateService.convertToInvoice(user, params.id, warehouseId);
      return NextResponse.json(invoice, { status: 201 });
    }

    const salesOrder = await EstimateService.convertToSalesOrder(user, params.id);
    return NextResponse.json(salesOrder, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
