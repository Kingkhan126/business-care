import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from "@/lib/auth/session";

describe("Session & Security Utilities", () => {
  it("should hash and verify passwords correctly", async () => {
    const raw = "SuperSecretPassword123!";
    const hash = await hashPassword(raw);

    expect(hash).not.toEqual(raw);
    expect(await verifyPassword(raw, hash)).toBe(true);
    expect(await verifyPassword("WrongPassword", hash)).toBe(false);
  });

  it("should sign and verify JWT session tokens", async () => {
    const payload = {
      userId: "usr_999",
      email: "test@company.com",
      activeOrganizationId: "org_888",
    };

    const token = await createSessionToken(payload);
    expect(typeof token).toBe("string");

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toEqual("usr_999");
    expect(verified?.activeOrganizationId).toEqual("org_888");
  });
});
