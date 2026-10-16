import { beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { runVercelBuild } from "../../scripts/vercel-build.mjs";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); spawnSync.mockReturnValue({ status: 0 }); });

describe("Vercel release migration gate", () => {
  it("does not build or publish the new app when its migrations fail", () => {
    spawnSync.mockReturnValueOnce({ status: 0 }).mockReturnValueOnce({ status: 1 });
    expect(runVercelBuild({ DATABASE_URL: "test-url" })).toBe(1);
    expect(spawnSync).toHaveBeenCalledTimes(2);
    expect(spawnSync.mock.calls.some(([, args]) => args.includes("node_modules/next/dist/bin/next"))).toBe(false);
  });

  it("uses a direct connection only for migrations and retains the runtime pool for the app", () => {
    const env = { DATABASE_URL: "pooled-url", DIRECT_URL: "direct-url" };
    expect(runVercelBuild(env)).toBe(0);
    expect(spawnSync.mock.calls[1][1]).toEqual(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
    expect(spawnSync.mock.calls[1][2].env.DATABASE_URL).toBe("direct-url");
    expect(spawnSync.mock.calls[2][2].env.DATABASE_URL).toBe("pooled-url");
    expect(env.DATABASE_URL).toBe("pooled-url");
  });

  it.each(["Error: P3005", "\u001b[31mP3005\u001b[0m"])("records the verified baseline for Prisma output %s", (errorOutput) => {
    spawnSync.mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 1, stderr: errorOutput })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 });
    expect(runVercelBuild({ DATABASE_URL: "test-url" })).toBe(0);
    const calls = spawnSync.mock.calls.map(([, args]) => args.slice(1));
    expect(calls[2]).toContain("--exit-code");
    expect(calls[3]).toEqual(["migrate", "resolve", "--applied", "0_init"]);
    expect(calls[4]).toEqual(["migrate", "deploy"]);
    expect(calls[5]).toEqual(["build"]);
  });

  it("does not baseline or build when an untracked database differs from the initial schema", () => {
    spawnSync.mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 1, stderr: "Error: P3005" })
      .mockReturnValueOnce({ status: 2 })
      .mockReturnValueOnce({ status: 1, stderr: "Error: P3005" });
    expect(runVercelBuild({ DATABASE_URL: "test-url" })).toBe(1);
    expect(spawnSync.mock.calls.some(([, args]) => args.includes("resolve") || args.includes("node_modules/next/dist/bin/next"))).toBe(false);
  });

  it("continues when another deployment has already recorded the verified baseline", () => {
    spawnSync.mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 1, stderr: "\u001b[31mP3005\u001b[0m" })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 1, stderr: "\u001b[31mP3008\u001b[0m" })
      .mockReturnValueOnce({ status: 0 });
    expect(runVercelBuild({ DATABASE_URL: "test-url" })).toBe(0);
    expect(spawnSync.mock.calls[4][1]).toEqual(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  });
});
