import { describe, it, expect } from "vitest";
import { LoginSchema, RegisterSchema } from "@/lib/validation/auth";
import { UpdateOrganizationSchema } from "@/lib/validation/organization";

describe("Zod Validation Schemas", () => {
  it("should validate valid login inputs", () => {
    const valid = LoginSchema.safeParse({
      email: "user@example.com",
      password: "Password123!",
    });
    expect(valid.success).toBe(true);
  });

  it("should reject invalid login email", () => {
    const invalid = LoginSchema.safeParse({
      email: "not-an-email",
      password: "Password123!",
    });
    expect(invalid.success).toBe(false);
  });

  it("should validate register input with password requirements", () => {
    const valid = RegisterSchema.safeParse({
      name: "John Doe",
      email: "john@acme.com",
      password: "Password123!",
      organizationName: "Acme Corp",
    });
    expect(valid.success).toBe(true);
  });

  it("should reject weak register passwords", () => {
    const invalid = RegisterSchema.safeParse({
      name: "John Doe",
      email: "john@acme.com",
      password: "weak",
      organizationName: "Acme Corp",
    });
    expect(invalid.success).toBe(false);
  });

  it("should validate organization updates", () => {
    const valid = UpdateOrganizationSchema.safeParse({
      name: "Acme Global LLC",
      legalName: "Acme Global LLC",
      currency: "USD",
      timezone: "America/New_York",
      country: "US",
      fiscalYearStart: 1,
    });
    expect(valid.success).toBe(true);
  });
});
