import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { TeamService } from "@/server/services/TeamService";
import { AppError } from "@/lib/errors";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const updated = await TeamService.revokeInvitation(user, params.id);
    return NextResponse.json({ success: true, invitation: updated });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to revoke invitation" },
      { status: 400 }
    );
  }
}
