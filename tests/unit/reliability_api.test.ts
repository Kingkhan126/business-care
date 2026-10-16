import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/errors/http";
import { parsePagination, validDate } from "@/lib/validation/query";
import { ForbiddenError } from "@/lib/errors";
import { POST } from "@/app/api/invoices/route";

vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn(async () => ({ id: "owner", activeOrganizationId: "org", permissions: ["invoices.create"] })) }));
vi.mock("@/server/services/InvoiceService", () => ({ InvoiceService: { create: vi.fn(() => { throw new Error("Database should not be called for invalid input"); }) } }));
afterEach(() => vi.restoreAllMocks());

describe("API validation and safe errors", () => {
  it("returns field validation errors with status 400 instead of a server error", async () => {
    const response = await POST(new Request("http://localhost/api/invoices", { method: "POST", body: JSON.stringify({ customerId: "", lines: [] }) }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.details.some((issue: { path: string[] }) => issue.path[0] === "customerId")).toBe(true);
  });
  it("handles malformed JSON without exposing the submitted body", async () => {
    const response = await POST(new Request("http://localhost/api/invoices", { method: "POST", body: '{"secret":"private"' }));
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain("private");
  });
  it("preserves permission errors and maps uniqueness errors to conflicts", () => {
    expect(apiErrorResponse(new ForbiddenError()).status).toBe(403);
    expect(apiErrorResponse({ code: "P2002", meta: "sensitive-table" }).status).toBe(409);
  });
  it("does not leak unexpected database errors or request values", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = apiErrorResponse(new Error("passwordHash=private, database credentials"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private");
    expect(JSON.stringify(log.mock.calls)).not.toContain("private");
  });
  it("rethrows framework rendering signals instead of swallowing them", () => {
    const signal = Object.assign(new Error("Dynamic rendering"), { digest: "DYNAMIC_SERVER_USAGE" });
    expect(() => apiErrorResponse(signal)).toThrow(signal);
  });
  it("rejects unbounded, negative, fractional, or malformed pagination", () => {
    for (const query of ["take=100000", "skip=-1", "take=1.5", "take=5abc", "take=0", "skip=Infinity"]) {
      expect(() => parsePagination(new URLSearchParams(query))).toThrow(z.ZodError);
    }
    expect(parsePagination(new URLSearchParams())).toEqual({ skip: 0, take: 50 });
  });
  it("rejects invalid transaction dates", () => {
    expect(validDate.safeParse("not-a-date").success).toBe(false);
    expect(validDate.safeParse("2026-10-16").success).toBe(true);
  });
});
