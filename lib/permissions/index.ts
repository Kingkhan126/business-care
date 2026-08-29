import type { SessionPayload } from "@/lib/auth/session";

export class UnauthorizedError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function requireSession(session: SessionPayload | null): SessionPayload {
  if (!session) throw new UnauthorizedError("Please log in to continue.");
  return session;
}

export function requireAdmin(session: SessionPayload | null): SessionPayload {
  const s = requireSession(session);
  if (s.role !== "ADMIN" && s.role !== "PHARMACIST") throw new UnauthorizedError();
  return s;
}

export function canAccessOrder(
  session: SessionPayload,
  order: { userId: string }
): boolean {
  return session.role === "ADMIN" || session.role === "PHARMACIST" || order.userId === session.userId;
}
