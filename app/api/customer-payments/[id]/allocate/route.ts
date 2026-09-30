import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { CustomerPaymentService } from "@/server/services/CustomerPaymentService";
import { CustomerPaymentAllocationSchema } from "@/lib/validation/transactions";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const validated = CustomerPaymentAllocationSchema.parse(body);

    const allocation = await CustomerPaymentService.allocatePayment(user, params.id, validated);
    return NextResponse.json(allocation, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
