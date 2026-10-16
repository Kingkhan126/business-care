import { apiErrorResponse } from "@/lib/errors/http";
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
  } catch (err) {
    return apiErrorResponse(err);
  }
}
