import { apiErrorResponse } from "@/lib/errors/http";
import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { OnboardingService } from "@/server/services/OnboardingService";
import { CompleteOnboardingStepSchema } from "@/lib/validation/organization_settings";
import { AppError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = CompleteOnboardingStepSchema.parse(body);

    const updatedOrg = await OnboardingService.completeStep(user, validated.step);
    return NextResponse.json({ success: true, organization: updatedOrg });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
