import { db } from "@/db/client";
import { OrganizationRepository } from "../repositories/OrganizationRepository";
import { OrganizationSettingsRepository } from "../repositories/OrganizationSettingsRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { NotFoundError } from "@/lib/errors";

export class OnboardingService {
  static async getOnboardingState(user: SessionUser) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);

    const org = await OrganizationRepository.findById(user.activeOrganizationId);
    if (!org) {
      throw new NotFoundError("Organization not found");
    }

    const settings = await OrganizationSettingsRepository.findByOrganizationId(user.activeOrganizationId);

    return {
      organizationId: org.id,
      name: org.name,
      legalName: org.legalName,
      description: org.description,
      registrationNumber: org.registrationNumber,
      taxId: org.taxId,
      email: org.email,
      phone: org.phone,
      website: org.website,
      logoUrl: org.logoUrl,
      currency: org.currency,
      timezone: org.timezone,
      addressLine1: org.addressLine1,
      addressLine2: org.addressLine2,
      city: org.city,
      state: org.state,
      postalCode: org.postalCode,
      country: org.country,
      fiscalYearStart: org.fiscalYearStart,
      onboardingCompleted: org.onboardingCompleted,
      onboardingStep: org.onboardingStep,
      settings,
    };
  }

  static async completeStep(user: SessionUser, step: number) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);

    const isCompleted = step >= 6;

    const updatedOrg = await db.organization.update({
      where: { id: user.activeOrganizationId },
      data: {
        onboardingStep: step,
        onboardingCompleted: isCompleted,
      },
    });

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: "onboarding.step_completed",
      entityType: "Organization",
      entityId: user.activeOrganizationId,
      metadata: { step, isCompleted },
    });

    return updatedOrg;
  }
}
