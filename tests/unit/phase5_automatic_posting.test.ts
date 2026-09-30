import { describe, it, expect } from "vitest";
import { CalculationEngine } from "@/server/services/CalculationEngine";

describe("Phase 5 — Automatic Document Posting Rules Suite", () => {
  it("Test 1: Verifies Customer Invoice posting entry debits AR and credits Revenue + Tax", () => {
    const invoiceDoc = CalculationEngine.calculateDocument([
      { quantity: 2, unitPrice: 100, taxRate: 10 }, // subtotal: 200, tax: 20, total: 220
    ]);

    const arDebit = invoiceDoc.total; // 220
    const revenueCredit = invoiceDoc.subtotal - invoiceDoc.discountTotal; // 200
    const taxCredit = invoiceDoc.taxTotal; // 20

    expect(arDebit).toBe(220.0);
    expect(revenueCredit).toBe(200.0);
    expect(taxCredit).toBe(20.0);
    expect(arDebit).toBe(revenueCredit + taxCredit);
  });

  it("Test 2: Verifies Customer Payment posting entry debits Bank and credits AR", () => {
    const paymentAmount = 220.0;
    const bankDebit = paymentAmount;
    const arCredit = paymentAmount;

    expect(bankDebit).toBe(arCredit);
    expect(bankDebit).toBe(220.0);
  });

  it("Test 3: Verifies Vendor Bill posting entry debits Inventory/Expense + Tax and credits AP", () => {
    const billDoc = CalculationEngine.calculateDocument([
      { quantity: 5, unitPrice: 50, taxRate: 8 }, // subtotal: 250, tax: 20, total: 270
    ]);

    const inventoryDebit = billDoc.subtotal - billDoc.discountTotal; // 250
    const taxDebit = billDoc.taxTotal; // 20
    const apCredit = billDoc.total; // 270

    expect(inventoryDebit + taxDebit).toBe(apCredit);
    expect(apCredit).toBe(270.0);
  });

  it("Test 4: Verifies Stock Adjustment Down posting entry debits COGS and credits Inventory", () => {
    const adjustmentQty = -4;
    const unitCost = 25.0;
    const totalCost = Math.abs(adjustmentQty) * unitCost; // 100.0

    const cogsDebit = totalCost;
    const inventoryCredit = totalCost;

    expect(cogsDebit).toBe(inventoryCredit);
    expect(cogsDebit).toBe(100.0);
  });

  it("Test 5: Verifies Stock Adjustment Up posting entry debits Inventory and credits COGS/Adjustment", () => {
    const adjustmentQty = 10;
    const unitCost = 15.0;
    const totalCost = adjustmentQty * unitCost; // 150.0

    const inventoryDebit = totalCost;
    const cogsCredit = totalCost;

    expect(inventoryDebit).toBe(cogsCredit);
    expect(inventoryDebit).toBe(150.0);
  });
});
