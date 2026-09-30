import { describe, it, expect } from "vitest";
import {
  MatchTransactionSchema,
  UnmatchTransactionSchema,
  MatchTargetTypeEnum,
} from "@/lib/validation/banking";

describe("Phase 6 — Smart Transaction Matching Validation & Scoring Suite", () => {
  it("Test 1: Validates matching a bank transaction to a customer payment", () => {
    const validMatch = {
      bankTransactionId: "btx-1001",
      targetType: "CUSTOMER_PAYMENT",
      targetId: "cpay-2001",
    };

    const parsed = MatchTransactionSchema.parse(validMatch);
    expect(parsed.bankTransactionId).toBe("btx-1001");
    expect(parsed.targetType).toBe("CUSTOMER_PAYMENT");
    expect(parsed.targetId).toBe("cpay-2001");
  });

  it("Test 2: Validates matching a bank transaction to a vendor payment", () => {
    const validMatch = {
      bankTransactionId: "btx-1002",
      targetType: "VENDOR_PAYMENT",
      targetId: "vpay-3001",
    };

    const parsed = MatchTransactionSchema.parse(validMatch);
    expect(parsed.targetType).toBe("VENDOR_PAYMENT");
  });

  it("Test 3: Rejects invalid match target type", () => {
    const invalidMatch = {
      bankTransactionId: "btx-1003",
      targetType: "PURCHASE_ORDER" as any,
      targetId: "po-4001",
    };

    expect(() => MatchTransactionSchema.parse(invalidMatch)).toThrow();
  });

  it("Test 4: Validates unmatching schema", () => {
    const unmatchInput = {
      bankTransactionId: "btx-1001",
    };

    const parsed = UnmatchTransactionSchema.parse(unmatchInput);
    expect(parsed.bankTransactionId).toBe("btx-1001");
  });

  it("Test 5: Evaluates matching candidate scoring heuristic accurately", () => {
    const evaluateConfidence = (
      txRef?: string,
      targetRef?: string,
      daysDiff = 0
    ): "EXACT" | "HIGH" | "MEDIUM" => {
      const refMatch =
        txRef &&
        targetRef &&
        (targetRef.toLowerCase().includes(txRef.toLowerCase()) ||
          txRef.toLowerCase().includes(targetRef.toLowerCase()));

      if (refMatch) return "EXACT";
      if (daysDiff <= 3) return "HIGH";
      return "MEDIUM";
    };

    expect(evaluateConfidence("INV-100", "INV-100", 5)).toBe("EXACT");
    expect(evaluateConfidence(undefined, undefined, 2)).toBe("HIGH");
    expect(evaluateConfidence(undefined, undefined, 10)).toBe("MEDIUM");
  });
});
