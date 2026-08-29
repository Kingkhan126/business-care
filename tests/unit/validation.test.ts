import { describe, it, expect } from "vitest";

describe("Prescription Upload Validation", () => {
  it("validates prescription file extension", () => {
    const isValidFile = (mimeType: string) =>
      ["image/jpeg", "image/png", "application/pdf"].includes(mimeType);

    expect(isValidFile("application/pdf")).toBe(true);
    expect(isValidFile("image/jpeg")).toBe(true);
    expect(isValidFile("text/plain")).toBe(false);
  });
});
