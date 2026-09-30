import { z } from "zod";

export const UpdateUserProfileSchema = z.object({
  name: z.string().trim().min(2, "Full name must be at least 2 characters"),
  phone: z.string().trim().optional(),
});

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;
