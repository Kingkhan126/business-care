/** Public user fields allowed in business records and API responses. */
export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  status: true,
} as const;
