import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { readFileSync } from "node:fs";

function sqlStatements(sql) {
  return sql.replace(/^\s*--[^\r\n]*/gm, "").split(";").map(statement => statement.trim().replace(/\s+/g, " ")).filter(Boolean);
}

/** Allow only exact foreign-key additions already reviewed in the initial migration. */
export function missingForeignKeyStatements(sql) {
  const initial = readFileSync(new URL("../prisma/migrations/0_init/migration.sql", import.meta.url), "utf8");
  const allowed = new Set(sqlStatements(initial).filter(statement => /^ALTER TABLE "\w+" ADD CONSTRAINT "\w+" FOREIGN KEY /.test(statement)));
  const statements = sqlStatements(sql);
  return statements.length > 0 && statements.every(statement => allowed.has(statement)) ? statements : null;
}

function hasPrismaError(result, code) {
  const output = stripVTControlCharacters(`${result.stdout || ""}\n${result.stderr || ""}`);
  return new RegExp(`\\b${code}\\b`).test(output);
}

function prisma(args, env, input) {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], {
    env, input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"], encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

function compareBaseline(env, script = false) {
  return prisma([
    "migrate", "diff", "--from-schema-datasource", "prisma/schema.prisma",
    "--to-schema-datamodel", "prisma/migrations/0_init/schema.prisma", "--exit-code",
    ...(script ? ["--script"] : []),
  ], env);
}

function repairMissingForeignKeys(env) {
  const diff = compareBaseline(env, true);
  if (diff.status !== 2) return diff.status === 0;
  const statements = missingForeignKeyStatements(diff.stdout || "");
  if (!statements) {
    console.error("Automatic repair refused: schema differences include changes other than missing baseline foreign keys.");
    return false;
  }
  console.log(`Verifying existing records and restoring ${statements.length} missing baseline foreign keys in one transaction.`);
  const guarded = statements.map(statement => {
    const [, table, constraint] = statement.match(/^ALTER TABLE "(\w+)" ADD CONSTRAINT "(\w+)"/);
    // Serialize concurrent builds and skip constraints another build already restored.
    return `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"${table}"'::regclass AND conname = '${constraint}') THEN ${statement}; END IF; END $$;`;
  });
  const repaired = prisma(["db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], env,
    `BEGIN;\nSET LOCAL lock_timeout = '10s';\nSET LOCAL statement_timeout = '60s';\nSELECT pg_advisory_xact_lock(742168290);\n${guarded.join("\n")}\nCOMMIT;\n`);
  if (repaired.status !== 0) {
    console.error("Foreign-key repair failed and was rolled back. Existing records were preserved; review any orphaned references or lock errors above.");
    return false;
  }
  return compareBaseline(env).status === 0;
}

/** Adopt an existing database only after proving it matches the immutable baseline. */
export function deployMigrations(env = process.env) {
  const migrationEnv = env.DIRECT_URL ? { ...env, DATABASE_URL: env.DIRECT_URL } : env;
  const deployed = prisma(["migrate", "deploy"], migrationEnv);
  if (deployed.status === 0) return 0;
  if (!hasPrismaError(deployed, "P3005")) return deployed.status || 1;

  console.log("Existing database detected. Verifying the initial schema before recording its migration history.");
  const diff = compareBaseline(migrationEnv);
  console.log(`Initial schema comparison completed (exit code: ${diff.status ?? "unavailable"}, signal: ${diff.signal || "none"}).`);
  if (diff.status !== 0) {
    // Another deployment may have completed while this one checked the schema.
    if (diff.status === 2 && prisma(["migrate", "deploy"], migrationEnv).status === 0) return 0;
    if (diff.status !== 2 || !repairMissingForeignKeys(migrationEnv)) {
      console.error("Baseline verification failed. Existing records were preserved. Review the schema difference before baselining.");
      return 1;
    }
  }

  const baseline = prisma(["migrate", "resolve", "--applied", "0_init"], migrationEnv);
  // Concurrent deployments sharing this database may have recorded it first.
  if (baseline.status !== 0 && !hasPrismaError(baseline, "P3008")) return baseline.status || 1;
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
  // Let pending stdout/stderr writes finish before Node exits, including on build failure.
  process.exitCode = process.argv.includes("--migrate-only") ? deployMigrations() : runVercelBuild();
  if (process.exitCode !== 0) console.error(`Release stopped (exit code: ${process.exitCode}). See the preceding migration or build diagnostics.`);
}
