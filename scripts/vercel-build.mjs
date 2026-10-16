import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function prisma(args, env) {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], {
    env, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

/** Adopt an existing database only after proving it matches the immutable baseline. */
export function deployMigrations(env = process.env) {
  const migrationEnv = env.DIRECT_URL ? { ...env, DATABASE_URL: env.DIRECT_URL } : env;
  const deployed = prisma(["migrate", "deploy"], migrationEnv);
  if (deployed.status === 0) return 0;
  if (!/\bP3005\b/.test(`${deployed.stdout || ""}\n${deployed.stderr || ""}`)) return deployed.status || 1;

  console.log("Existing database detected. Verifying the initial schema before recording its migration history.");
  const diff = prisma([
    "migrate", "diff",
    "--from-schema-datasource", "prisma/schema.prisma",
    "--to-schema-datamodel", "prisma/migrations/0_init/schema.prisma",
    "--exit-code",
  ], migrationEnv);
  if (diff.status !== 0) {
    // Another deployment may have completed while this one checked the schema.
    if (diff.status === 2 && prisma(["migrate", "deploy"], migrationEnv).status === 0) return 0;
    console.error("Baseline verification failed. No existing tables or data were changed. Review the schema difference before baselining.");
    return 1;
  }

  const baseline = prisma(["migrate", "resolve", "--applied", "0_init"], migrationEnv);
  // Concurrent deployments sharing this database may have recorded it first.
  if (baseline.status !== 0 && !/\bP3008\b/.test(`${baseline.stdout || ""}\n${baseline.stderr || ""}`)) return baseline.status || 1;
  const migrated = prisma(["migrate", "deploy"], migrationEnv);
  return migrated.status === 0 ? 0 : migrated.status || 1;
}

/** Apply committed migrations before publishing code that depends on them. */
export function runVercelBuild(env = process.env) {
  const generated = prisma(["generate"], env);
  if (generated.status !== 0) return generated.status || 1;
  const migrated = deployMigrations(env);
  if (migrated !== 0) return migrated;
  const built = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { env, stdio: "inherit" });
  if (built.error) throw built.error;
  return built.status === 0 ? 0 : built.status || 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(process.argv.includes("--migrate-only") ? deployMigrations() : runVercelBuild());
}
