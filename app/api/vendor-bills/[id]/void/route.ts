import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { VendorBillService } from "@/server/services/VendorBillService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const voided = await VendorBillService.voidBill(user, params.id);
    return NextResponse.json(voided);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
