import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/vendor-bills/route";
import { VendorBillService } from "@/server/services/VendorBillService";
import { OrganizationService } from "@/server/services/OrganizationService";

vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn().mockResolvedValue({ id: "owner", activeOrganizationId: "org" }) }));
vi.mock("@/server/services/VendorBillService", () => ({ VendorBillService: { create: vi.fn().mockResolvedValue({ id: "bill" }) } }));
vi.mock("@/server/services/OrganizationService", () => ({ OrganizationService: { getWorkspaceSummary: vi.fn().mockResolvedValue({ name: "Business", currency: "PKR", timezone: "Asia/Karachi" }) } }));
beforeEach(() => vi.clearAllMocks());

const body = { supplierId: "supplier", issueDate: "2026-10-20", dueDate: "2026-11-19", lines: [{ description: "Purchase", quantity: 1, unitPrice: 50 }] };

describe("Vendor bill currency", () => {
  it("defaults omitted currency to the authenticated organization's PKR setting", async () => {
    const response = await POST(new Request("https://example.test/api/vendor-bills", { method: "POST", body: JSON.stringify(body) }));
    expect(response.status).toBe(201);
    expect(VendorBillService.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ currency: "PKR" }));
  });

  it("preserves an explicitly supplied foreign currency", async () => {
    const response = await POST(new Request("https://example.test/api/vendor-bills", { method: "POST", body: JSON.stringify({ ...body, currency: "USD" }) }));
    expect(response.status).toBe(201);
    expect(VendorBillService.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ currency: "USD" }));
    expect(OrganizationService.getWorkspaceSummary).not.toHaveBeenCalled();
  });
});
