import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { OrganizationService } from "@/server/services/OrganizationService";
import { UpdateOrganizationProfileSchema } from "@/lib/validation/organization_settings";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const org = await OrganizationService.getOrganization(user);
    return NextResponse.json({ success: true, organization: org });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch organization" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = UpdateOrganizationProfileSchema.parse(body);

    const updatedOrg = await OrganizationService.updateProfile(user, validated);
    return NextResponse.json({ success: true, organization: updatedOrg });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update organization" },
      { status: 400 }
    );
  }
}
