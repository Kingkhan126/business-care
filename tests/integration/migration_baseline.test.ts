import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

describe("Existing database migration adoption", () => {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  if (!url.pathname.endsWith("_test")) throw new Error("A dedicated test database is required");
  const suffix = randomUUID().replaceAll("-", "");
  const schemas = [`migration_baseline_${suffix}`, `migration_drift_${suffix}`];
  const admin = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const clients = schemas.map(schema => {
    const scopedUrl = new URL(url);
    scopedUrl.searchParams.set("schema", schema);
    const env = { ...process.env, DATABASE_URL: scopedUrl.toString(), DIRECT_URL: scopedUrl.toString() };
    return { env, client: new PrismaClient({ datasources: { db: { url: scopedUrl.toString() } } }) };
  });
  const run = (args: string[], env: NodeJS.ProcessEnv) => spawnSync(process.execPath, args, { env, encoding: "utf8", timeout: 25000 });

  beforeAll(async () => {
    for (let index = 0; index < schemas.length; index++) {
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${schemas[index]}"`);
      const result = run(["node_modules/prisma/build/index.js", "db", "execute", "--file", "prisma/migrations/0_init/migration.sql", "--schema", "prisma/schema.prisma"], clients[index].env);
      expect(result.status, result.stderr).toBe(0);
      await clients[index].client.user.create({ data: { email: "preserved@test.invalid", name: "Existing record", passwordHash: "test-only" } });
    }
  });

  afterAll(async () => {
    for (const { client } of clients) await client.$disconnect();
    for (const schema of schemas) {
      // Only this test's generated namespaces inside the dedicated test database.
      if (!/^migration_(baseline|drift)_[a-f0-9]{32}$/.test(schema)) throw new Error("Unexpected schema cleanup target");
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await admin.$disconnect();
  });

  it("baselines matching existing tables, applies the new migration, and preserves records", async () => {
    const { env, client } = clients[0];
    const result = run(["scripts/vercel-build.mjs", "--migrate-only"], { ...env, FORCE_COLOR: "1" });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(await client.user.count()).toBe(1);
    expect(await client.user.findUnique({ where: { email: "preserved@test.invalid" } })).not.toBeNull();
    expect(await client.documentSequence.count()).toBe(0);
    const migrations = await client.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`;
    expect(migrations.map(m => m.migration_name)).toEqual(["0_init", "202610160001_reliable_document_numbers"]);
    const again = run(["scripts/vercel-build.mjs", "--migrate-only"], env);
    expect(again.status, again.stderr).toBe(0);
    expect(await client.user.count()).toBe(1);
  });

  it("refuses schema drift without marking the baseline or changing existing records", async () => {
    const { env, client } = clients[1];
    await admin.$executeRawUnsafe(`ALTER TABLE "${schemas[1]}"."Customer" DROP COLUMN "legalName"`);
    const result = run(["scripts/vercel-build.mjs", "--migrate-only"], env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Baseline verification failed");
    expect(result.stdout).toContain("Initial schema comparison completed (exit code: 2");
    expect(result.stderr).toContain("Release stopped (exit code: 1)");
    expect(await client.user.count()).toBe(1);
    const migrations = await client.$queryRaw<Array<{ exists: boolean }>>`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '_prisma_migrations') AS exists`;
    expect(migrations[0].exists).toBe(false);
  });
});
