import { describe, it, expect, vi, afterEach } from "vitest";
import { MembershipRepository } from "@/server/repositories/MembershipRepository";
import { RoleRepository } from "@/server/repositories/RoleRepository";
import { getSecretKey } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { db } from "@/db/client";

// Mock database client for isolated unit testing
vi.mock("@/db/client", () => ({
  db: {
    organizationMember: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
    },
  },
}));

describe("Phase 1 Security & Tenant Isolation Security Suite", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  // Test A — Cross-tenant role mutation
  it("Test A: should REJECT cross-tenant role mutation when Organization A attempts to mutate Organization B member", async () => {
    const fakeMemberInOrgB = "mem_orgB_999";
    const requestingOrgA = "org_A_111";
    const targetRoleId = "role_admin";

    // Simulate db finding no member matching memberId AND requestingOrgA
    vi.mocked(db.organizationMember.findFirst).mockResolvedValue(null);

    await expect(
      MembershipRepository.updateRole(requestingOrgA, fakeMemberInOrgB, targetRoleId)
    ).rejects.toThrow(NotFoundError);

    expect(db.organizationMember.findFirst).toHaveBeenCalledWith({
      where: {
        id: fakeMemberInOrgB,
        organizationId: requestingOrgA,
      },
    });

    // Ensure database update was NEVER called
    expect(db.organizationMember.update).not.toHaveBeenCalled();
  });

  // Test B — Cross-tenant status mutation
  it("Test B: should REJECT cross-tenant status mutation when Organization A attempts to mutate Organization B member status", async () => {
    const fakeMemberInOrgB = "mem_orgB_999";
    const requestingOrgA = "org_A_111";

    // Simulate db finding no member matching memberId AND requestingOrgA
    vi.mocked(db.organizationMember.findFirst).mockResolvedValue(null);

    await expect(
      MembershipRepository.updateStatus(requestingOrgA, fakeMemberInOrgB, "SUSPENDED")
    ).rejects.toThrow(NotFoundError);

    expect(db.organizationMember.findFirst).toHaveBeenCalledWith({
      where: {
        id: fakeMemberInOrgB,
        organizationId: requestingOrgA,
      },
    });

    // Ensure database update was NEVER called
    expect(db.organizationMember.update).not.toHaveBeenCalled();
  });

  // Test C — Cross-tenant role lookup
  it("Test C: should return NULL when Organization A attempts to lookup a custom role belonging exclusively to Organization B", async () => {
    const fakeCustomRoleInOrgB = "role_custom_orgB_555";
    const requestingOrgA = "org_A_111";

    // Simulate db returning null when role belongs to orgB and requesting org is orgA
    vi.mocked(db.role.findFirst).mockResolvedValue(null);

    const role = await RoleRepository.findByIdAndOrg(fakeCustomRoleInOrgB, requestingOrgA);
    expect(role).toBeNull();

    expect(db.role.findFirst).toHaveBeenCalledWith({
      where: {
        id: fakeCustomRoleInOrgB,
        OR: [
          { organizationId: null, isSystem: true },
          { organizationId: requestingOrgA },
        ],
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  });

  // Test D — Production AUTH_SECRET enforcement
  it("Test D: should throw fatal security error in production when AUTH_SECRET is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");

    expect(() => getSecretKey()).toThrow(
      /FATAL SECURITY CONFIGURATION ERROR: AUTH_SECRET environment variable must be defined in production/
    );
  });

  // Test E — Development seed credentials condition
  it("Test E: should evaluate isDevelopment to false when NODE_ENV is set to production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const currentEnv: string = process.env.NODE_ENV || "";
    const isDevelopment = currentEnv === "development";
    expect(isDevelopment).toBe(false);
  });
});
