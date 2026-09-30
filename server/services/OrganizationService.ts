import { db } from "@/db/client";
import { OrganizationRepository } from "../repositories/OrganizationRepository";
import { OrganizationSettingsRepository } from "../repositories/OrganizationSettingsRepository";
import { MembershipRepository } from "../repositories/MembershipRepository";
import { RoleRepository } from "../repositories/RoleRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { storageService, StorageFile } from "@/lib/storage";
import { SessionUser } from "@/types/auth";
import { assertTenantAccess } from "../authorization/tenant";
import { requirePermission } from "../authorization/permissions";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { UpdateOrganizationProfileInput } from "@/lib/validation/organization_settings";
import { UpdateOrganizationSettingsInput } from "@/lib/validation/organization_settings";

export class OrganizationService {
  static async getOrganization(user: SessionUser) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "organization.view");

    const org = await OrganizationRepository.findById(user.activeOrganizationId);
    if (!org) {
      throw new NotFoundError("Organization not found");
    }

    const settings = await OrganizationSettingsRepository.findByOrganizationId(user.activeOrganizationId);

    return {
      ...org,
      settings,
    };
  }

  static async updateProfile(user: SessionUser, input: UpdateOrganizationProfileInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "organization.update");

    const updated = await OrganizationRepository.update(user.activeOrganizationId, input);

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: "organization.profile_updated",
      entityType: "Organization",
      entityId: updated.id,
      metadata: { fields: Object.keys(input) },
    });

    return updated;
  }

  static async getSettings(user: SessionUser) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "organization.view");

    return OrganizationSettingsRepository.findByOrganizationId(user.activeOrganizationId);
  }

  static async updateSettings(user: SessionUser, input: UpdateOrganizationSettingsInput) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "organization.update");

    // Also update main Organization currency, timezone, and fiscalYearStart
    await OrganizationRepository.update(user.activeOrganizationId, {
      currency: input.currency,
      timezone: input.timezone,
      fiscalYearStart: input.fiscalYearStart,
    });

    const updatedSettings = await OrganizationSettingsRepository.updateSettings(
      user.activeOrganizationId,
      {
        dateFormat: input.dateFormat,
        timeFormat: input.timeFormat,
        numberFormat: input.numberFormat,
        taxInclusivePricing: input.taxInclusivePricing,
        taxRegistrationNumber: input.taxRegistrationNumber,
        defaultTaxRate: input.defaultTaxRate,
        invoicePrefix: input.invoicePrefix,
        estimatePrefix: input.estimatePrefix,
        purchaseOrderPrefix: input.purchaseOrderPrefix,
        billPrefix: input.billPrefix,
        nextInvoiceNumber: input.nextInvoiceNumber,
        nextEstimateNumber: input.nextEstimateNumber,
        nextPurchaseOrderNumber: input.nextPurchaseOrderNumber,
      }
    );

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: "organization.settings_updated",
      entityType: "OrganizationSettings",
      entityId: updatedSettings.id,
      metadata: { currency: input.currency, timezone: input.timezone },
    });

    return updatedSettings;
  }

  static async uploadLogo(user: SessionUser, file: StorageFile) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "organization.update");

    const logoUrl = await storageService.uploadLogo(user.activeOrganizationId, file);

    const updatedOrg = await db.organization.update({
      where: { id: user.activeOrganizationId },
      data: { logoUrl },
    });

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: "organization.logo_updated",
      entityType: "Organization",
      entityId: user.activeOrganizationId,
      metadata: { logoUrl },
    });

    return updatedOrg;
  }

  static async removeLogo(user: SessionUser) {
    if (!user.activeOrganizationId) {
      throw new NotFoundError("No active organization selected");
    }

    assertTenantAccess(user, user.activeOrganizationId);
    requirePermission(user, "organization.update");

    await storageService.deleteLogo(user.activeOrganizationId);

    const updatedOrg = await db.organization.update({
      where: { id: user.activeOrganizationId },
      data: { logoUrl: null },
    });

    await AuditRepository.create({
      organization: { connect: { id: user.activeOrganizationId } },
      actor: { connect: { id: user.id } },
      action: "organization.logo_removed",
      entityType: "Organization",
      entityId: user.activeOrganizationId,
    });

    return updatedOrg;
  }

  static async switchOrganization(user: SessionUser, targetOrganizationId: string) {
    // Validate caller membership in target org
    const membership = await MembershipRepository.findByOrgAndUser(targetOrganizationId, user.id);
    if (!membership || membership.status !== "ACTIVE") {
      throw new ValidationError("You are not an active member of the requested organization tenant.");
    }

    const org = await OrganizationRepository.findById(targetOrganizationId);
    if (!org) {
      throw new NotFoundError("Requested organization not found.");
    }

    await AuditRepository.create({
      organization: { connect: { id: targetOrganizationId } },
      actor: { connect: { id: user.id } },
      action: "organization.switched",
      entityType: "Organization",
      entityId: targetOrganizationId,
    });

    return { organization: org, membership };
  }
}
