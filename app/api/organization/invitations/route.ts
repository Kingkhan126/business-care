import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { TeamService } from "@/server/services/TeamService";
import { InviteMemberSchema } from "@/lib/validation/organization";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const invitations = await TeamService.listInvitations(user);
    return NextResponse.json({ success: true, invitations });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = InviteMemberSchema.parse(body);

    const invitation = await TeamService.createInvitation(user, validated);
    return NextResponse.json({
      success: true,
      invitation,
      message: "Invitation created (Email delivery pending/not configured in dev mode)",
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to create invitation" },
      { status: 400 }
    );
  }
}
