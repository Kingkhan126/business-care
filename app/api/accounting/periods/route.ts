import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { AccountingPeriodService } from "@/server/services/AccountingPeriodService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const fiscalYear = searchParams.get("fiscalYear") ? Number(searchParams.get("fiscalYear")) : undefined;

    const periods = await AccountingPeriodService.list(user, { fiscalYear });
    return NextResponse.json({ success: true, data: periods });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const fiscalYear = Number(body.fiscalYear || new Date().getFullYear());

    const periods = await AccountingPeriodService.generateFiscalYearPeriods(user, fiscalYear);
    return NextResponse.json({ success: true, data: periods }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
