import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { OrganizationService } from "@/server/services/OrganizationService";
import { UpdateOrganizationSettingsSchema } from "@/lib/validation/organization_settings";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const settings = await OrganizationService.getSettings(user);
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = UpdateOrganizationSettingsSchema.parse(body);

    const settings = await OrganizationService.updateSettings(user, validated);
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
