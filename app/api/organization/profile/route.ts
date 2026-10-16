import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { OrganizationService } from "@/server/services/OrganizationService";
import { UpdateOrganizationProfileSchema } from "@/lib/validation/organization_settings";
import { AppError } from "@/lib/errors";

export async function PUT(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = UpdateOrganizationProfileSchema.parse(body);

    const updated = await OrganizationService.updateProfile(user, validated);
    return NextResponse.json({ success: true, organization: updated });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
