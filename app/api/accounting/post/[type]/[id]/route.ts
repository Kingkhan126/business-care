import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { AccountingPostingService } from "@/server/services/AccountingPostingService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(
  req: Request,
  { params }: { params: { type: string; id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { type, id } = params;
    let result;

    switch (type.toLowerCase()) {
      case 'invoice':
      case 'sales-invoice':
        result = await AccountingPostingService.postInvoice(user, id);
        break;
      case 'customer-payment':
        result = await AccountingPostingService.postCustomerPayment(user, id);
        break;
      case 'credit-note':
        result = await AccountingPostingService.postCreditNote(user, id);
        break;
      case 'bill':
      case 'vendor-bill':
        result = await AccountingPostingService.postVendorBill(user, id);
        break;
      case 'vendor-payment':
        result = await AccountingPostingService.postVendorPayment(user, id);
        break;
      case 'vendor-credit':
        result = await AccountingPostingService.postVendorCredit(user, id);
        break;
      case 'stock-adjustment':
        result = await AccountingPostingService.postStockAdjustment(user, id);
        break;
      default:
        return NextResponse.json({ error: `Unsupported transaction type for accounting posting: ${type}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
