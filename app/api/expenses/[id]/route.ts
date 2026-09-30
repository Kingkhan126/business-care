import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { ExpenseService } from "@/server/services/ExpenseService";
import { UpdateExpenseSchema } from "@/lib/validation/expense";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const expense = await ExpenseService.getExpenseById(user, params.id);
    return NextResponse.json(expense);
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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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
      expenseNumber: _num,
      subtotal: _sub,
      taxTotal: _tax,
      total: _tot,
      ...sanitizedBody
    } = body;

    const validated = UpdateExpenseSchema.parse(sanitizedBody);
    const updated = await ExpenseService.updateExpense(user, params.id, validated);

    return NextResponse.json(updated);
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
