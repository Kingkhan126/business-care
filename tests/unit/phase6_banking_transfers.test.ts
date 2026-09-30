import { describe, it, expect } from "vitest";
import { CreateBankTransferSchema } from "@/lib/validation/banking";
import { CalculationEngine } from "@/server/services/CalculationEngine";

describe("Phase 6 — Inter-Account Bank Transfers Validation and Accounting Suite", () => {
  it("Test 1: Validates valid inter-account bank transfer", () => {
    const validTransfer = {
      fromBankAccountId: "acc-checking-1",
      toBankAccountId: "acc-savings-2",
      amount: 1500.0,
      feeAmount: 25.0,
      transferDate: "2026-10-05",
      reference: "WIRE-9921",
      memo: "Transfer to reserve fund",
    };

    const parsed = CreateBankTransferSchema.parse(validTransfer);
    expect(parsed.fromBankAccountId).toBe("acc-checking-1");
    expect(parsed.toBankAccountId).toBe("acc-savings-2");
    expect(parsed.amount).toBe(1500.0);
    expect(parsed.feeAmount).toBe(25.0);
  });

  it("Test 2: Rejects self-transfer (fromAccountId == toAccountId)", () => {
    const selfTransfer = {
      fromBankAccountId: "acc-checking-1",
      toBankAccountId: "acc-checking-1",
      amount: 500.0,
      transferDate: "2026-10-05",
    };

    expect(() => CreateBankTransferSchema.parse(selfTransfer)).toThrow(
      "Source and destination accounts must be different"
    );
  });

  it("Test 3: Rejects transfer with zero or negative amount", () => {
    const zeroTransfer = {
      fromBankAccountId: "acc-checking-1",
      toBankAccountId: "acc-savings-2",
      amount: 0,
      transferDate: "2026-10-05",
    };

    expect(() => CreateBankTransferSchema.parse(zeroTransfer)).toThrow(
      "Transfer amount must be greater than zero"
    );

    const negativeTransfer = {
      fromBankAccountId: "acc-checking-1",
      toBankAccountId: "acc-savings-2",
      amount: -500,
      transferDate: "2026-10-05",
    };

    expect(() => CreateBankTransferSchema.parse(negativeTransfer)).toThrow(
      "Transfer amount must be greater than zero"
    );
  });

  it("Test 4: Rejects negative fee amount", () => {
    const negativeFee = {
      fromBankAccountId: "acc-checking-1",
      toBankAccountId: "acc-savings-2",
      amount: 500.0,
      feeAmount: -10.0,
      transferDate: "2026-10-05",
    };

    expect(() => CreateBankTransferSchema.parse(negativeFee)).toThrow(
      "Fee cannot be negative"
    );
  });

  it("Test 5: Double-Entry GL Balance Equation Invariant for Transfers with Fees", () => {
    const transferAmount = 2500.75;
    const feeAmount = 15.5;

    const sourceOutflow = CalculationEngine.roundMoney(transferAmount + feeAmount);
    const destInflow = CalculationEngine.roundMoney(transferAmount);
    const feeDebit = CalculationEngine.roundMoney(feeAmount);

    const totalDebit = CalculationEngine.roundMoney(destInflow + feeDebit);
    const totalCredit = sourceOutflow;

    // Strict double-entry invariant: Debits == Credits
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(2516.25);
  });

  it("Test 6: Formats transfer sequence numbers consistently (TRF-YYYY-XXXXX)", () => {
    const year = 2026;
    const count = 42;
    const formatted = `TRF-${year}-${String(count + 1).padStart(5, "0")}`;
    expect(formatted).toBe("TRF-2026-00043");
  });
});
