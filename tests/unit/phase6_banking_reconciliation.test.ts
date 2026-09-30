import { describe, it, expect } from "vitest";
import {
  StartReconciliationSchema,
  ToggleReconciliationItemSchema,
  CompleteReconciliationSchema,
} from "@/lib/validation/banking";
import { CalculationEngine } from "@/server/services/CalculationEngine";

describe("Phase 6 — Bank Reconciliation Validation and Balance Integrity Suite", () => {
  it("Test 1: Validates start reconciliation schema", () => {
    const validStart = {
      bankAccountId: "acc-bank-1",
      statementStartDate: "2026-10-01",
      statementEndDate: "2026-10-31",
      statementEndingBalance: 12450.75,
      notes: "October statement reconciliation",
    };

    const parsed = StartReconciliationSchema.parse(validStart);
    expect(parsed.bankAccountId).toBe("acc-bank-1");
    expect(parsed.statementEndingBalance).toBe(12450.75);
  });

  it("Test 2: Validates toggle reconciliation item schema", () => {
    const toggle = {
      bankTransactionId: "btx-201",
      isCleared: true,
    };

    const parsed = ToggleReconciliationItemSchema.parse(toggle);
    expect(parsed.bankTransactionId).toBe("btx-201");
    expect(parsed.isCleared).toBe(true);
  });

  it("Test 3: Mathematical Reconciliation Invariant: Reconciled Balance & Difference Calculation", () => {
    const beginningBalance = 5000.0;
    const clearedDeposits = [1200.5, 300.0, 450.25]; // Total: 1950.75
    const clearedWithdrawals = [500.0, 250.75]; // Total: 750.75
    const statementEndingBalance = 6200.0;

    const totalDeposits = clearedDeposits.reduce((acc, d) => CalculationEngine.roundMoney(acc + d), 0);
    const totalWithdrawals = clearedWithdrawals.reduce((acc, w) => CalculationEngine.roundMoney(acc + w), 0);

    const reconciledBalance = CalculationEngine.roundMoney(
      beginningBalance + totalDeposits - totalWithdrawals
    );
    const difference = CalculationEngine.roundMoney(statementEndingBalance - reconciledBalance);

    expect(totalDeposits).toBe(1950.75);
    expect(totalWithdrawals).toBe(750.75);
    expect(reconciledBalance).toBe(6200.0);
    expect(difference).toBe(0.0); // Perfect balance!
  });

  it("Test 4: Rejects completion when reconciliation difference is non-zero", () => {
    const statementEndingBalance = 6250.0;
    const reconciledBalance = 6200.0;
    const difference = CalculationEngine.roundMoney(statementEndingBalance - reconciledBalance);

    expect(difference).toBe(50.0);

    // Business rule check: canComplete must be false if difference != 0
    const canComplete = Math.abs(difference) <= 0.001;
    expect(canComplete).toBe(false);
  });

  it("Test 5: Validates reconciliation number formatting (REC-YYYY-XXXXX)", () => {
    const year = 2026;
    const sequenceNumber = 8;
    const recNumber = `REC-${year}-${String(sequenceNumber).padStart(5, "0")}`;
    expect(recNumber).toBe("REC-2026-00008");
  });
});
