import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser, createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { OrganizationService } from "@/server/services/OrganizationService";
import { SwitchOrganizationSchema } from "@/lib/validation/organization_settings";
import { AppError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = SwitchOrganizationSchema.parse(body);

    const { organization } = await OrganizationService.switchOrganization(
      user,
      validated.organizationId
    );

    // Issue updated session token with new activeOrganizationId
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      activeOrganizationId: organization.id,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      activeOrganizationId: organization.id,
      organizationName: organization.name,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
