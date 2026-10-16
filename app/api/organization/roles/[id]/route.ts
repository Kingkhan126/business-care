import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { RoleService } from "@/server/services/RoleService";
import { UpdateCustomRoleSchema } from "@/lib/validation/organization_settings";
import { AppError } from "@/lib/errors";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = UpdateCustomRoleSchema.parse({ ...body, roleId: params.id });

    const role = await RoleService.updateCustomRole(user, validated);
    return NextResponse.json({ success: true, role });
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

    await RoleService.deleteCustomRole(user, params.id);
    return NextResponse.json({ success: true, message: "Custom role deleted" });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
