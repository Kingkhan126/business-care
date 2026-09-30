import { describe, it, expect, vi, afterEach } from "vitest";
import { LocalDiskStorageService } from "@/lib/storage";
import { TeamService } from "@/server/services/TeamService";
import { UpdateOrganizationSettingsSchema } from "@/lib/validation/organization_settings";
import { SessionUser } from "@/types/auth";
import { ValidationError } from "@/lib/errors";
import { db } from "@/db/client";
import crypto from "crypto";

vi.mock("@/db/client", () => ({
  db: {
    $transaction: vi.fn((cb) => cb(db)),
    organizationMember: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    organizationInvitation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe("Phase 2 Audit & Remediation Security Verification Suite", () => {
  const userOrgA: SessionUser = {
    id: "usr_owner_A",
    email: "owner@acme.com",
    name: "Owner User",
    activeOrganizationId: "org_A",
    roleId: "role_owner",
    roleName: "Owner",
    permissions: ["organization.update", "organization.members.manage", "users.view", "users.manage"],
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("Test A: Rejects SVG files containing dangerous script tags or event handlers (Stored XSS Defense)", async () => {
    const storage = new LocalDiskStorageService();
    const maliciousSvgContent = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert('XSS')</script></svg>`;
    const buffer = Buffer.from(maliciousSvgContent, "utf8");

    await expect(
      storage.uploadLogo("org_A", {
        buffer,
        filename: "logo.svg",
        mimeType: "image/svg+xml",
        sizeBytes: buffer.length,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("Test B: Hashes invitation tokens with SHA-256 before database storage", async () => {
    (db.role.findFirst as any).mockResolvedValue({ id: "role_member", name: "Member" });
    (db.organizationInvitation.create as any).mockImplementation(async ({ data }: any) => ({
      id: "inv_123",
      ...data,
    }));
    (db.auditLog.create as any).mockResolvedValue({});

    const result = await TeamService.createInvitation(userOrgA, {
      email: "invitee@example.com",
      roleId: "role_member",
    });

    const expectedHash = crypto.createHash("sha256").update(result.token).digest("hex");
    expect(db.organizationInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          token: expectedHash,
        }),
      })
    );
  });

  it("Test C: Rejects unsupported currency codes and invalid IANA timezones", async () => {
    const invalidCurrencyResult = UpdateOrganizationSettingsSchema.safeParse({
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
      numberFormat: "comma_dot",
      currency: "XYZ", // Invalid currency
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
    });

    expect(invalidCurrencyResult.success).toBe(false);

    const invalidTimezoneResult = UpdateOrganizationSettingsSchema.safeParse({
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
      numberFormat: "comma_dot",
      currency: "USD",
      timezone: "Invalid/Timezone_ID", // Invalid IANA timezone
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
    });

    expect(invalidTimezoneResult.success).toBe(false);
  });

  it("Test D: Executes owner status update inside a database transaction", async () => {
    (db.organizationMember.findFirst as any).mockResolvedValue({
      id: "mem_owner",
      organizationId: "org_A",
      role: { name: "Owner" },
      status: "ACTIVE",
    });
    (db.organizationMember.count as any).mockResolvedValue(2); // 2 owners, deactivating 1 is safe
    (db.organizationMember.update as any).mockResolvedValue({ id: "mem_owner", status: "SUSPENDED" });
    (db.auditLog.create as any).mockResolvedValue({});

    await TeamService.updateMemberStatus(userOrgA, "mem_owner", "SUSPENDED");

    expect(db.$transaction).toHaveBeenCalled();
  });
});
