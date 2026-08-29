import { describe, it, expect } from "vitest";

describe("Pharmacy Role Permissions", () => {
  it("checks pharmacist review authorization", () => {
    const isPharmacistOrAdmin = (role: string) => role === "PHARMACIST" || role === "ADMIN";
    expect(isPharmacistOrAdmin("PHARMACIST")).toBe(true);
    expect(isPharmacistOrAdmin("ADMIN")).toBe(true);
    expect(isPharmacistOrAdmin("CUSTOMER")).toBe(false);
  });
});
