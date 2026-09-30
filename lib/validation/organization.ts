import { z } from "zod";

export const UpdateOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Business name must be at least 2 characters"),
  legalName: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  website: z.string().trim().url("Invalid URL format").optional().or(z.literal("")),
  currency: z.string().length(3, "Currency code must be 3 characters (e.g., USD)"),
  timezone: z.string().min(1, "Timezone is required"),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().length(2, "Country code must be 2 characters (e.g. US)"),
  fiscalYearStart: z.number().min(1).max(12),
});

export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;

export const InviteMemberSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  roleId: z.string().min(1, "Role selection is required"),
});

export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

export const UpdateMemberRoleSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  roleId: z.string().min(1, "Role selection is required"),
});

export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
