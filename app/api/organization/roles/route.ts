import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { RoleService } from "@/server/services/RoleService";
import { CreateCustomRoleSchema } from "@/lib/validation/organization_settings";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const roles = await RoleService.listRoles(user);
    const permissions = await RoleService.listAllPermissions(user);
    return NextResponse.json({ success: true, roles, permissions });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = CreateCustomRoleSchema.parse(body);

    const role = await RoleService.createCustomRole(user, validated);
    return NextResponse.json({ success: true, role });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
