import { parsePagination } from "@/lib/validation/query";
import { apiErrorResponse } from "@/lib/errors/http";
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
    const { skip, take } = parsePagination(searchParams);

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
    return apiErrorResponse(error);
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
    return apiErrorResponse(error);
  }
}
