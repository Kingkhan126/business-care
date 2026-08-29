/**
 * In-memory sliding-window rate limiter. Fine for a single server instance /
 * local development. In production with multiple instances, replace this
 * with a shared store (e.g. Upstash Redis) so limits apply across instances —
 * noted in README under "Known limitations".
 */
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, number[]>();

export function checkRateLimit(key: string): { allowed: boolean } {
  const now = Date.now();
  const existing = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (existing.length >= MAX_ATTEMPTS) {
    attempts.set(key, existing);
    return { allowed: false };
  }

  existing.push(now);
  attempts.set(key, existing);
  return { allowed: true };
}
