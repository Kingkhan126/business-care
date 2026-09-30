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
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to switch organization" },
      { status: 400 }
    );
  }
}
