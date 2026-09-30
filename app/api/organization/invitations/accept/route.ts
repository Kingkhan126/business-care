import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { TeamService } from "@/server/services/TeamService";
import { AppError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: "Invitation token is required" }, { status: 400 });
    }

    const membership = await TeamService.acceptInvitation(user, token);
    return NextResponse.json({ success: true, membership });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to accept invitation" },
      { status: 400 }
    );
  }
}
