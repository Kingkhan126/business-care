export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  activeOrganizationId?: string | null;
  roleId?: string | null;
  roleName?: string | null;
  permissions: string[];
}

export interface JWTPayload {
  userId: string;
  email: string;
  activeOrganizationId?: string | null;
  iat?: number;
  exp?: number;
}
