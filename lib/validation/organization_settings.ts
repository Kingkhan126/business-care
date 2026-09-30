import { z } from "zod";

export const UpdateOrganizationProfileSchema = z.object({
  name: z.string().trim().min(2, "Business name must be at least 2 characters"),
  legalName: z.string().trim().optional(),
  description: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  website: z.string().trim().url("Invalid website URL").optional().or(z.literal("")),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().length(2, "Country code must be 2 letters (e.g. US)"),
});

export type UpdateOrganizationProfileInput = z.infer<typeof UpdateOrganizationProfileSchema>;

import { SUPPORTED_CURRENCIES } from "@/lib/formatting";

const ALLOWED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code);

export const UpdateOrganizationSettingsSchema = z.object({
  dateFormat: z.enum(["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"]),
  timeFormat: z.enum(["12h", "24h"]),
  numberFormat: z.enum(["comma_dot", "dot_comma", "space_dot"]),
  currency: z
    .string()
    .length(3, "Currency code must be 3 characters")
    .transform((val) => val.toUpperCase())
    .refine((val) => ALLOWED_CURRENCY_CODES.includes(val), {
      message: "Unsupported currency code. Please select a supported business currency.",
    }),
  timezone: z.string().min(1, "Timezone is required").refine(
    (tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid IANA timezone identifier (e.g. UTC, America/New_York)." }
  ),
  fiscalYearStart: z.number().min(1).max(12),
  taxInclusivePricing: z.boolean(),
  taxRegistrationNumber: z.string().trim().optional(),
  defaultTaxRate: z.number().min(0).max(100),
  invoicePrefix: z.string().trim().min(1, "Invoice prefix is required"),
  estimatePrefix: z.string().trim().min(1, "Estimate prefix is required"),
  purchaseOrderPrefix: z.string().trim().min(1, "Purchase order prefix is required"),
  billPrefix: z.string().trim().min(1, "Bill prefix is required"),
  nextInvoiceNumber: z.number().min(1),
  nextEstimateNumber: z.number().min(1),
  nextPurchaseOrderNumber: z.number().min(1),
});

export type UpdateOrganizationSettingsInput = z.infer<typeof UpdateOrganizationSettingsSchema>;

export const CreateCustomRoleSchema = z.object({
  name: z.string().trim().min(2, "Role name must be at least 2 characters"),
  description: z.string().trim().optional(),
  permissionCodes: z.array(z.string()).min(1, "Select at least one permission for this role"),
});

export type CreateCustomRoleInput = z.infer<typeof CreateCustomRoleSchema>;

export const UpdateCustomRoleSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
  name: z.string().trim().min(2, "Role name must be at least 2 characters"),
  description: z.string().trim().optional(),
  permissionCodes: z.array(z.string()).min(1, "Select at least one permission for this role"),
});

export type UpdateCustomRoleInput = z.infer<typeof UpdateCustomRoleSchema>;

export const SwitchOrganizationSchema = z.object({
  organizationId: z.string().min(1, "Target organization ID is required"),
});

export type SwitchOrganizationInput = z.infer<typeof SwitchOrganizationSchema>;

export const CompleteOnboardingStepSchema = z.object({
  step: z.number().min(1).max(6),
  data: z.record(z.unknown()).optional(),
});

export type CompleteOnboardingStepInput = z.infer<typeof CompleteOnboardingStepSchema>;
