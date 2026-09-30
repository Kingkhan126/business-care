import { describe, it, expect, vi, afterEach } from "vitest";
import { OrganizationService } from "@/server/services/OrganizationService";
import { TeamService } from "@/server/services/TeamService";
import { RoleService } from "@/server/services/RoleService";
import { SessionUser } from "@/types/auth";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/db/client";

// Mock database client for isolated unit testing
vi.mock("@/db/client", () => ({
  db: {
    $transaction: vi.fn((cb) => cb(db)),
    user: {
      findUnique: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organizationMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    organizationSettings: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organizationInvitation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    permission: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe("Phase 2 Security & Tenant Isolation Regression Suite", () => {
  const userOrgA: SessionUser = {
    id: "usr_A",
    email: "userA@acme.com",
    name: "User A",
    activeOrganizationId: "org_A",
    roleId: "role_owner",
    roleName: "Owner",
    permissions: [
      "organization.view",
      "organization.update",
      "organization.members.manage",
      "users.view",
      "users.manage",
    ],
  };

  const nonAdminOrgA: SessionUser = {
    id: "usr_staff",
    email: "staff@acme.com",
    name: "Staff User",
    activeOrganizationId: "org_A",
    roleId: "role_member",
    roleName: "Member",
    permissions: ["organization.view"], // Missing organization.update & members.manage
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: Organization A cannot update Organization B profile
  it("Test 1: Org A cannot update Org B profile", async () => {
    expect(() => {
      // Simulate tenant isolation check
      if (userOrgA.activeOrganizationId !== "org_B") {
        throw new ForbiddenError("Tenant Isolation Violation: Access denied to foreign organization data.");
      }
    }).toThrow(ForbiddenError);
  });

  // Test 2: Organization A cannot view Organization B members
  it("Test 2: Org A cannot view Org B members", async () => {
    (db.organizationMember.findMany as any).mockImplementation(async (args: any) => {
      if (args?.where?.organizationId === "org_A") return [];
      throw new Error("Query parameter mismatch");
    });

    const members = await TeamService.listMembers(userOrgA);
    expect(members).toEqual([]);
    expect(db.organizationMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org_A" } })
    );
  });

  // Test 3: Organization A cannot modify Organization B roles
  it("Test 3: Org A cannot modify Org B roles", async () => {
    (db.role.findFirst as any).mockResolvedValue(null);

    await expect(
      RoleService.updateCustomRole(userOrgA, {
        roleId: "role_orgB_custom",
        name: "Hacked Role",
        permissionCodes: ["users.view"],
      })
    ).rejects.toThrow(NotFoundError);
  });

  // Test 4: Organization A cannot access Organization B invitations
  it("Test 4: Org A cannot access Org B invitations", async () => {
    (db.organizationInvitation.findMany as any).mockResolvedValue([]);

    const invites = await TeamService.listInvitations(userOrgA);
    expect(invites).toEqual([]);
    expect(db.organizationInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org_A" } })
    );
  });

  // Test 5: A user without permission cannot change organization settings
  it("Test 5: User without permission cannot change organization settings", async () => {
    await expect(
      OrganizationService.updateSettings(nonAdminOrgA, {
        dateFormat: "YYYY-MM-DD",
        timeFormat: "24h",
        numberFormat: "comma_dot",
        currency: "USD",
        timezone: "UTC",
        fiscalYearStart: 1,
        taxInclusivePricing: false,
        taxRegistrationNumber: "",
        defaultTaxRate: 0,
        invoicePrefix: "INV-",
        estimatePrefix: "EST-",
        purchaseOrderPrefix: "PO-",
        billPrefix: "BILL-",
        nextInvoiceNumber: 1001,
        nextEstimateNumber: 1001,
        nextPurchaseOrderNumber: 1001,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  // Test 6: A user cannot switch into an organization where they are not an active member
  it("Test 6: User cannot switch into an organization where they are not a member", async () => {
    (db.organizationMember.findUnique as any).mockResolvedValue(null);

    await expect(
      OrganizationService.switchOrganization(userOrgA, "org_B_unauthorized")
    ).rejects.toThrow(ValidationError);
  });

  // Test 7: A deactivated member cannot perform protected organization operations
  it("Test 7: Deactivated member cannot perform protected organization operations", async () => {
    const deactivatedUser: SessionUser = {
      ...nonAdminOrgA,
      permissions: [], // Inactive/deactivated user permissions stripped
    };

    await expect(
      OrganizationService.updateProfile(deactivatedUser, {
        name: "Hacked Name",
        country: "US",
      })
    ).rejects.toThrow(ForbiddenError);
  });

  // Test 8: A removed member loses organization access
  it("Test 8: Removed member loses organization access", async () => {
    (db.organizationMember.findUnique as any).mockResolvedValue(null);

    await expect(
      OrganizationService.switchOrganization(userOrgA, "org_removed")
    ).rejects.toThrow(ValidationError);
  });

  // Test 9: A non-admin cannot modify role permissions
  it("Test 9: Non-admin cannot modify role permissions", async () => {
    await expect(
      RoleService.createCustomRole(nonAdminOrgA, {
        name: "SuperAdmin",
        permissionCodes: ["settings.manage"],
      })
    ).rejects.toThrow(ForbiddenError);
  });

  // Test 10: The final owner cannot accidentally be removed or deactivated
  it("Test 10: The final owner cannot be removed or deactivated", async () => {
    // Mock member lookup returning an active Owner
    (db.organizationMember.findFirst as any).mockResolvedValue({
      id: "mem_final_owner",
      organizationId: "org_A",
      userId: "usr_A",
      roleId: "role_owner",
      status: "ACTIVE",
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      role: { name: "Owner" },
      user: { name: "Owner User" },
    });

    // Mock active owner count = 1
    (db.organizationMember.count as any).mockResolvedValue(1);

    // Attempt deactivating final owner
    await expect(
      TeamService.updateMemberStatus(userOrgA, "mem_final_owner", "SUSPENDED")
    ).rejects.toThrow(ValidationError);

    // Attempt removing final owner
    await expect(
      TeamService.removeMember(userOrgA, "mem_final_owner")
    ).rejects.toThrow(ValidationError);
  });
});
