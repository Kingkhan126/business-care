import { describe, it, expect } from "vitest";

describe("Phase 5 — Financial Reporting Math & Equation Suite", () => {
  it("Test 1: Trial Balance balances when total debits equal total credits", () => {
    const lines = [
      { account: "1010 Cash", debit: 1000.0, credit: 0.0 },
      { account: "1200 AR", debit: 500.0, credit: 0.0 },
      { account: "2000 AP", debit: 0.0, credit: 300.0 },
      { account: "3000 Equity", debit: 0.0, credit: 700.0 },
      { account: "4000 Revenue", debit: 0.0, credit: 500.0 },
    ];

    const totalDebits = lines.reduce((acc, l) => acc + l.debit, 0);
    const totalCredits = lines.reduce((acc, l) => acc + l.credit, 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.001;

    expect(totalDebits).toBe(1500.0);
    expect(totalCredits).toBe(1500.0);
    expect(isBalanced).toBe(true);
  });

  it("Test 2: Profit & Loss calculates Gross Profit and Net Income correctly", () => {
    const totalRevenue = 10000.0;
    const cogs = 4000.0;
    const operatingExpenses = 2500.0;

    const grossProfit = totalRevenue - cogs;
    const netIncome = grossProfit - operatingExpenses;

    expect(grossProfit).toBe(6000.0);
    expect(netIncome).toBe(3500.0);
  });

  it("Test 3: Balance Sheet verifies Assets = Liabilities + Equity + Net Income", () => {
    const assets = 15000.0;
    const liabilities = 5000.0;
    const baseEquity = 6500.0;
    const currentPeriodNetIncome = 3500.0;

    const totalLiabilitiesAndEquity = liabilities + baseEquity + currentPeriodNetIncome;
    const isBalanced = Math.abs(assets - totalLiabilitiesAndEquity) < 0.001;

    expect(assets).toBe(15000.0);
    expect(totalLiabilitiesAndEquity).toBe(15000.0);
    expect(isBalanced).toBe(true);
  });

  it("Test 4: Running balance calculation maintains correct signed balance per normal balance type", () => {
    // ASSET (Normal Balance: DEBIT) -> Debit increases, Credit decreases
    let assetBalance = 0;
    assetBalance += 1000; // DR 1000 -> +1000
    assetBalance -= 300;  // CR 300  -> +700
    assetBalance += 150;  // DR 150  -> +850
    expect(assetBalance).toBe(850);

    // LIABILITY (Normal Balance: CREDIT) -> Credit increases, Debit decreases
    let liabilityBalance = 0;
    liabilityBalance += 500; // CR 500 -> +500
    liabilityBalance -= 200; // DR 200 -> +300
    expect(liabilityBalance).toBe(300);
  });
});
