import { vi } from "vitest";

// Existing unit fixtures mock database delegates. Real counter concurrency is
// verified separately against PostgreSQL by the integration suite.
export const nextDocumentNumber = vi.fn(async (tx: any, organizationId: string, kind: string, prefix: string, width = 6): Promise<string> => {
  const baseline = await tx[kind]?.count?.({ where: { organizationId } }) || 0;
  const calls = nextDocumentNumber.mock.calls.filter(call => call[0] === tx && call[1] === organizationId && call[2] === kind && call[3] === prefix).length;
  return `${prefix}${String(baseline + calls).padStart(width, "0")}`;
});
