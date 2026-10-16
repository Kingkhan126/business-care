import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { DashboardService } from "@/server/services/DashboardService";
import { SessionUser } from "@/types/auth";

vi.mock("@/db/client", () => ({ db: {
  organization: { findUnique: vi.fn() },
  journalEntryLine: { aggregate: vi.fn() },
  salesInvoice: { aggregate: vi.fn(), findMany: vi.fn() },
  expense: { aggregate: vi.fn(), findMany: vi.fn() },
  bankAccount: { aggregate: vi.fn(), findMany: vi.fn() },
  $queryRaw: vi.fn(),
} }));
const user: SessionUser = { id: "u", email: "user@test.invalid", name: "User", activeOrganizationId: "org-A", permissions: [] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(db.organization.findUnique).mockResolvedValue({ name: "Workspace", currency: "EUR", timezone: "UTC" } as never); });

describe("Dashboard authorization boundaries", () => {
  it("does not even query protected domains when the user lacks permission", async () => {
    await DashboardService.getSummary(user);
    for (const query of [db.journalEntryLine.aggregate, db.salesInvoice.aggregate, db.salesInvoice.findMany, db.expense.aggregate, db.expense.findMany, db.bankAccount.aggregate, db.bankAccount.findMany, db.$queryRaw]) expect(query).not.toHaveBeenCalled();
  });
  it("scopes invoice-only access to the active tenant, currency, and issued states", async () => {
    vi.mocked(db.salesInvoice.aggregate).mockResolvedValue({ _sum: { balanceDue: 75 } } as never);
    vi.mocked(db.salesInvoice.findMany).mockResolvedValue([]);
    const result = await DashboardService.getSummary({ ...user, permissions: ["invoices.read"] });
    expect(result.receivables).toBe(75);
    expect(db.salesInvoice.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org-A", currency: "EUR", status: { in: ["ISSUED", "PARTIALLY_PAID"] } } }));
    expect(db.journalEntryLine.aggregate).not.toHaveBeenCalled();
    expect(db.bankAccount.findMany).not.toHaveBeenCalled();
    expect(db.expense.findMany).not.toHaveBeenCalled();
  });
});
