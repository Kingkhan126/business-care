import { describe, expect, it, vi } from "vitest";
import { PUT } from "@/app/api/organization/route";
import { OrganizationService } from "@/server/services/OrganizationService";

vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn().mockResolvedValue({ id: "owner", activeOrganizationId: "org" }) }));
vi.mock("@/server/services/OrganizationService", () => ({ OrganizationService: { updateProfile: vi.fn().mockResolvedValue({ id: "org", currency: "PKR" }) } }));

describe("Organization form currency persistence", () => {
  it("passes currency and regional fields to persistence instead of silently discarding them", async () => {
    const body = { name: "Nouman", currency: "PKR", timezone: "Asia/Karachi", fiscalYearStart: 7, country: "PK" };
    const response = await PUT(new Request("https://example.test/api/organization", { method: "PUT", body: JSON.stringify(body) }));
    expect(response.status).toBe(200);
    expect(OrganizationService.updateProfile).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(body));
  });
});
