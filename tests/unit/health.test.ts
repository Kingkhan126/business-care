import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { GET } from "@/app/api/health/route";

vi.mock("@/db/client", () => ({ db: { $queryRaw: vi.fn(), documentSequence: { findFirst: vi.fn() } } }));
beforeEach(() => vi.resetAllMocks());

describe("Deployment readiness", () => {
  it("does not report a database with missing migrations as healthy", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ value: 1 }]);
    vi.mocked(db.documentSequence.findFirst).mockRejectedValue({ code: "P2021" });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "unhealthy", database: "connected", schema: "not_ready" });
  });
  it("reports a migrated database ready even before any document numbers exist", async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ value: 1 }]);
    vi.mocked(db.documentSequence.findFirst).mockResolvedValue(null);
    expect(await (await GET()).json()).toMatchObject({ status: "healthy", schema: "ready" });
  });
});
