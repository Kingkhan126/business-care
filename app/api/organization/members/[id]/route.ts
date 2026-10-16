import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { TeamService } from "@/server/services/TeamService";
import { AppError } from "@/lib/errors";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { roleId, status } = body;

    let result;
    if (roleId) {
      result = await TeamService.updateMemberRole(user, params.id, roleId);
    } else if (status) {
      result = await TeamService.updateMemberStatus(user, params.id, status);
    } else {
      return NextResponse.json(
        { success: false, error: "Either roleId or status must be provided" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, member: result });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await TeamService.removeMember(user, params.id);
    return NextResponse.json({ success: true, message: "Member removed" });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
