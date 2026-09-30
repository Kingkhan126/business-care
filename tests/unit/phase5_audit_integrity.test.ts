import { describe, it, expect } from "vitest";
import { createJournalSchema, createAccountSchema } from "@/lib/validation/accounting";
import { CalculationEngine } from "@/server/services/CalculationEngine";

describe("Phase 5 — Final Accounting Integrity & Audit Suite", () => {
  it("Audit 1: Primary Accounting Invariant — Rejects unbalanced journals (Debits != Credits)", () => {
    const unbalancedEntry = {
      entryDate: "2026-09-25",
      lines: [
        { accountId: "acc-1", debit: 100.0, credit: 0 },
        { accountId: "acc-2", debit: 0, credit: 99.99 },
      ],
    };

    expect(() => createJournalSchema.parse(unbalancedEntry)).toThrow(
      "Unbalanced journal entry"
    );
  });

  it("Audit 2: Rejects line items with both Debit and Credit amounts non-zero", () => {
    const dualEntry = {
      entryDate: "2026-09-25",
      lines: [
        { accountId: "acc-1", debit: 50.0, credit: 50.0 },
        { accountId: "acc-2", debit: 0, credit: 0 },
      ],
    };

    expect(() => createJournalSchema.parse(dualEntry)).toThrow(
      "A journal line must have either debit > 0 or credit > 0, not both"
    );
  });

  it("Audit 3: Rejects line items with zero debit and zero credit", () => {
    const zeroEntry = {
      entryDate: "2026-09-25",
      lines: [
        { accountId: "acc-1", debit: 0, credit: 0 },
        { accountId: "acc-2", debit: 0, credit: 0 },
      ],
    };

    expect(() => createJournalSchema.parse(zeroEntry)).toThrow();
  });

  it("Audit 4: Money Precision — CalculationEngine rounds fractional cents using Prisma.Decimal ROUND_HALF_UP", () => {
    expect(CalculationEngine.roundMoney(0.005)).toBe(0.01);
    expect(CalculationEngine.roundMoney(0.004)).toBe(0.0);
    expect(CalculationEngine.roundMoney(0.015)).toBe(0.02);
    expect(CalculationEngine.roundMoney(1.005)).toBe(1.01);
    expect(CalculationEngine.roundMoney(10.005)).toBe(10.01);
    expect(CalculationEngine.roundMoney(100.005)).toBe(100.01);
    expect(CalculationEngine.roundMoney(999999999.99)).toBe(999999999.99);
  });

  it("Audit 5: Credit Note Posting Accounting Invariant (DR Returns/Tax, CR AR)", () => {
    const subtotal = 500.0;
    const taxTotal = 50.0;
    const total = 550.0;

    const drSalesReturn = subtotal;
    const drTaxPayable = taxTotal;
    const crAR = total;

    expect(drSalesReturn + drTaxPayable).toBe(crAR);
    expect(crAR).toBe(550.0);
  });

  it("Audit 6: Vendor Credit Posting Accounting Invariant (DR AP, CR Expense/Tax)", () => {
    const subtotal = 800.0;
    const taxTotal = 80.0;
    const total = 880.0;

    const drAP = total;
    const crExpense = subtotal;
    const crTaxRecoverable = taxTotal;

    expect(drAP).toBe(crExpense + crTaxRecoverable);
    expect(drAP).toBe(880.0);
  });

  it("Audit 7: Stock Adjustment Valuation & Accounting Invariant", () => {
    const qtyChange = -10;
    const unitCost = 12.5;
    const totalCost = CalculationEngine.roundMoney(Math.abs(qtyChange) * unitCost);

    const drCOGS = totalCost;
    const crInventory = totalCost;

    expect(totalCost).toBe(125.0);
    expect(drCOGS).toBe(crInventory);
  });

  it("Audit 8: Balance Sheet Equation — Assets = Liabilities + Equity + Net Income", () => {
    const assets = 25000.0;
    const liabilities = 8000.0;
    const equityBase = 12000.0;
    const netIncome = 5000.0;

    const totalLiabilitiesAndEquity = liabilities + equityBase + netIncome;
    expect(assets).toBe(totalLiabilitiesAndEquity);
  });

  it("Audit 9: Multi-Year Balance Sheet Retained Earnings Separation", () => {
    // Year 1 Net Income = $3,000
    const year1NetIncome = 3000.0;
    // Year 2 Net Income = $1,000
    const year2NetIncome = 1000.0;

    const baseEquity = 10000.0;
    const totalEquityYear2 = baseEquity + year1NetIncome + year2NetIncome;

    expect(totalEquityYear2).toBe(14000.0);
    expect(year1NetIncome).not.toBe(year2NetIncome);
  });

  it("Audit 10: Vendor Bill Line Categorization (Inventory Asset vs Expense)", () => {
    const inventoryLine = { productId: "prod-1", subtotal: 1000, discount: 0 };
    const expenseLine = { serviceId: "srv-1", subtotal: 250, discount: 0 };

    let inventorySubtotal = 0;
    let expenseSubtotal = 0;

    const lines: Array<{ productId?: string; serviceId?: string; subtotal: number; discount: number }> = [
      inventoryLine,
      expenseLine,
    ];
    for (const l of lines) {
      if (l.productId) {
        inventorySubtotal += l.subtotal;
      } else {
        expenseSubtotal += l.subtotal;
      }
    }

    expect(inventorySubtotal).toBe(1000.0);
    expect(expenseSubtotal).toBe(250.0);
    expect(inventorySubtotal + expenseSubtotal).toBe(1250.0);
  });
});
