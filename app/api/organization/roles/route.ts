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
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch roles" },
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
    const validated = CreateCustomRoleSchema.parse(body);

    const role = await RoleService.createCustomRole(user, validated);
    return NextResponse.json({ success: true, role });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to create custom role" },
      { status: 400 }
    );
  }
}
