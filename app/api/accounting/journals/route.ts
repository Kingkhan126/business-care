import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { JournalEntryService } from "@/server/services/JournalEntryService";
import { createJournalSchema } from "@/lib/validation/accounting";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as any) || undefined;
    const source = (searchParams.get("source") as any) || undefined;
    const search = searchParams.get("search") || undefined;
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;
    const skip = searchParams.get("skip") ? parseInt(searchParams.get("skip")!, 10) : undefined;
    const take = searchParams.get("take") ? parseInt(searchParams.get("take")!, 10) : undefined;

    const result = await JournalEntryService.list(user, {
      status,
      source,
      search,
      startDate,
      endDate,
      skip,
      take,
    });

    return NextResponse.json({ success: true, data: result });
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
    const validated = createJournalSchema.parse(body);

    const journal = await JournalEntryService.createManualJournal(user, validated);

    return NextResponse.json({ success: true, data: journal }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
