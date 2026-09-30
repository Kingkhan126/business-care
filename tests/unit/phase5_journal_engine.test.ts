import { describe, it, expect } from "vitest";
import { createJournalSchema } from "@/lib/validation/accounting";

describe("Phase 5 — Double-Entry Journal Engine Validation Suite", () => {
  it("Test 1: Validates perfectly balanced journal entry (Debit == Credit)", () => {
    const balancedJournal = {
      entryDate: "2026-09-25",
      memo: "Opening Inventory Adjustment",
      lines: [
        {
          accountId: "acc-1-asset",
          debit: 500.0,
          credit: 0.0,
          description: "Increase Inventory Asset",
        },
        {
          accountId: "acc-2-equity",
          debit: 0.0,
          credit: 500.0,
          description: "Owner Equity Contribution",
        },
      ],
    };

    const result = createJournalSchema.parse(balancedJournal);
    expect(result.lines.length).toBe(2);
    const sumDebit = result.lines.reduce((acc, l) => acc + l.debit, 0);
    const sumCredit = result.lines.reduce((acc, l) => acc + l.credit, 0);
    expect(sumDebit).toBe(sumCredit);
  });

  it("Test 2: Rejects unbalanced journal entry (Debit != Credit)", () => {
    const unbalancedJournal = {
      entryDate: "2026-09-25",
      memo: "Unbalanced Entry",
      lines: [
        {
          accountId: "acc-1-asset",
          debit: 500.0,
          credit: 0.0,
        },
        {
          accountId: "acc-2-equity",
          debit: 0.0,
          credit: 499.99, // Off by 0.01
        },
      ],
    };

    expect(() => createJournalSchema.parse(unbalancedJournal)).toThrow(
      "Unbalanced journal entry: Total debits (500) must equal total credits (499.99)"
    );
  });

  it("Test 3: Rejects journal entry with less than 2 lines", () => {
    const singleLineJournal = {
      entryDate: "2026-09-25",
      lines: [
        {
          accountId: "acc-1-asset",
          debit: 100.0,
          credit: 0.0,
        },
      ],
    };

    expect(() => createJournalSchema.parse(singleLineJournal)).toThrow();
  });

  it("Test 4: Rejects line containing both non-zero debit and non-zero credit", () => {
    const invalidLineJournal = {
      entryDate: "2026-09-25",
      lines: [
        {
          accountId: "acc-1-asset",
          debit: 100.0,
          credit: 100.0, // Invalid: cannot have both debit and credit
        },
        {
          accountId: "acc-2-revenue",
          debit: 0.0,
          credit: 0.0,
        },
      ],
    };

    expect(() => createJournalSchema.parse(invalidLineJournal)).toThrow(
      "A journal line must have either debit > 0 or credit > 0, not both"
    );
  });

  it("Test 5: Rejects line with zero debit and zero credit", () => {
    const zeroLineJournal = {
      entryDate: "2026-09-25",
      lines: [
        {
          accountId: "acc-1-asset",
          debit: 0.0,
          credit: 0.0,
        },
        {
          accountId: "acc-2-revenue",
          debit: 0.0,
          credit: 0.0,
        },
      ],
    };

    expect(() => createJournalSchema.parse(zeroLineJournal)).toThrow(
      "A journal line must have either debit > 0 or credit > 0"
    );
  });
});
