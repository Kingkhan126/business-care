import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Apply committed migrations before publishing code that depends on them. */
export function runVercelBuild(env = process.env) {
  const migrationEnv = env.DIRECT_URL ? { ...env, DATABASE_URL: env.DIRECT_URL } : env;
  const steps = [
    { args: ["node_modules/prisma/build/index.js", "generate"], env },
    { args: ["node_modules/prisma/build/index.js", "migrate", "deploy"], env: migrationEnv },
    { args: ["node_modules/next/dist/bin/next", "build"], env },
  ];
  for (const step of steps) {
    const result = spawnSync(process.execPath, step.args, { env: step.env, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status || 1;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(runVercelBuild());
}
