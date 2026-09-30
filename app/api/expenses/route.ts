import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { ExpenseService } from "@/server/services/ExpenseService";
import { CreateExpenseSchema, ExpenseQuerySchema } from "@/lib/validation/expense";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const query = {
      status: searchParams.get("status") || undefined,
      expenseType: searchParams.get("expenseType") || undefined,
      paymentType: searchParams.get("paymentType") || undefined,
      claimantId: searchParams.get("claimantId") || undefined,
      supplierId: searchParams.get("supplierId") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      startDate: searchParams.get("startDate") || searchParams.get("dateFrom") || undefined,
      endDate: searchParams.get("endDate") || searchParams.get("dateTo") || undefined,
      search: searchParams.get("search") || undefined,
      skip: searchParams.get("skip") ? parseInt(searchParams.get("skip")!, 10) : undefined,
      take: searchParams.get("take") ? parseInt(searchParams.get("take")!, 10) : undefined,
    };

    const validatedQuery = ExpenseQuerySchema.parse(query);
    const result = await ExpenseService.listExpenses(user, validatedQuery);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();

    // Prevent mass-assignment: Strip authoritative fields
    const {
      organizationId: _org,
      status: _status,
      journalEntryId: _je,
      reimbursementJournalId: _rje,
      approvedById: _appr,
      postedAt: _posted,
      paidAt: _paid,
      createdById: _creator,
      ...sanitizedBody
    } = body;

    const validated = CreateExpenseSchema.parse(sanitizedBody);
    const expense = await ExpenseService.createExpense(user, validated);

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
