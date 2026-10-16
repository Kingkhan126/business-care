import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { JournalEntryService } from "@/server/services/JournalEntryService";
import { AppError, UnauthorizedError } from "@/lib/errors";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) throw new UnauthorizedError();

    const body = await req.json().catch(() => ({}));
    const reason = body?.reason || "Manual Reversal";

    const journal = await JournalEntryService.reverseJournal(user, params.id, reason);

    return NextResponse.json({ success: true, data: journal });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
