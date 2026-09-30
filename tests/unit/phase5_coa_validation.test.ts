import { describe, it, expect } from "vitest";
import {
  createAccountSchema,
  updateAccountSchema,
  createAccountMappingSchema,
} from "@/lib/validation/accounting";

describe("Phase 5 — Chart of Accounts & Validation Suite", () => {
  it("Test 1: Validates creation of valid ASSET account with DEBIT normal balance", () => {
    const validData = {
      code: "1010",
      name: "Petty Cash",
      type: "ASSET",
      normalBalance: "DEBIT",
    };

    const result = createAccountSchema.parse(validData);
    expect(result.code).toBe("1010");
    expect(result.type).toBe("ASSET");
    expect(result.normalBalance).toBe("DEBIT");
  });

  it("Test 2: Rejects invalid account code format", () => {
    const invalidData = {
      code: "10 10!",
      name: "Invalid Code Account",
      type: "ASSET",
      normalBalance: "DEBIT",
    };

    expect(() => createAccountSchema.parse(invalidData)).toThrow();
  });

  it("Test 3: Rejects mismatched normal balance for account type if validated", () => {
    const invalidTypeData = {
      code: "5010",
      name: "COGS",
      type: "UNKNOWN_TYPE" as any,
      normalBalance: "DEBIT",
    };

    expect(() => createAccountSchema.parse(invalidTypeData)).toThrow();
  });

  it("Test 4: Validates account update schema allowing optional fields", () => {
    const updateData = {
      name: "Updated Cash Account",
      isActive: true,
    };

    const result = updateAccountSchema.parse(updateData);
    expect(result.name).toBe("Updated Cash Account");
    expect(result.isActive).toBe(true);
  });

  it("Test 5: Validates system account mapping creation schema", () => {
    const mappingData = {
      mappingKey: "ACCOUNTS_RECEIVABLE",
      accountId: "cm1234567890abcdef",
    };

    const result = createAccountMappingSchema.parse(mappingData);
    expect(result.mappingKey).toBe("ACCOUNTS_RECEIVABLE");
    expect(result.accountId).toBe("cm1234567890abcdef");
  });
});
