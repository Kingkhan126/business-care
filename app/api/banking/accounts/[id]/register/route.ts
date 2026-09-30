import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { BankAccountService } from "@/server/services/BankAccountService";
import { BankTransactionService } from "@/server/services/BankTransactionService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as any) || undefined;
    const transactionType = (searchParams.get("transactionType") as any) || undefined;
    const search = searchParams.get("search") || undefined;
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;

    const [account, transactions] = await Promise.all([
      BankAccountService.getById(user, params.id),
      BankTransactionService.list(user, {
        bankAccountId: params.id,
        status,
        transactionType,
        search,
        startDate,
        endDate,
        take: 200,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        account,
        transactions: transactions.items,
        totalTransactions: transactions.total,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
