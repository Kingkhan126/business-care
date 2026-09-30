import { describe, it, expect } from "vitest";
import { hasPermission, requirePermission } from "@/server/authorization/permissions";
import { assertTenantAccess } from "@/server/authorization/tenant";
import { SessionUser } from "@/types/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

describe("Authorization & Multi-Tenant Security Foundation", () => {
  const mockUser: SessionUser = {
    id: "usr_123",
    email: "owner@acme.com",
    name: "Eleanor Vance",
    activeOrganizationId: "org_acme_100",
    roleId: "role_owner",
    roleName: "Owner",
    permissions: ["organization.view", "organization.update", "users.view", "customers.read"],
  };

  it("should grant access when user holds required permission", () => {
    expect(hasPermission(mockUser, "organization.view")).toBe(true);
    expect(hasPermission(mockUser, "customers.read")).toBe(true);
  });

  it("should deny access when permission is missing", () => {
    expect(hasPermission(mockUser, "invoices.delete")).toBe(false);
  });

  it("should throw ForbiddenError on missing permission in requirePermission", () => {
    expect(() => requirePermission(mockUser, "invoices.delete")).toThrow(ForbiddenError);
  });

  it("should throw UnauthorizedError on null user session", () => {
    expect(() => requirePermission(null, "organization.view")).toThrow(UnauthorizedError);
  });

  it("should allow matching tenant organization access", () => {
    expect(() => assertTenantAccess(mockUser, "org_acme_100")).not.toThrow();
  });

  it("should reject cross-tenant access to foreign organization data", () => {
    expect(() => assertTenantAccess(mockUser, "org_foreign_999")).toThrow(ForbiddenError);
  });
});
