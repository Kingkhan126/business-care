import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { OrganizationService } from "@/server/services/OrganizationService";
import { AppError, ValidationError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new ValidationError("No logo image file was provided");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const updatedOrg = await OrganizationService.uploadLogo(user, {
      buffer,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    return NextResponse.json({ success: true, logoUrl: updatedOrg.logoUrl });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await OrganizationService.removeLogo(user);
    return NextResponse.json({ success: true, message: "Logo removed" });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
