import { describe, it, expect } from "vitest";
import { CalculationEngine } from "@/server/services/CalculationEngine";

describe("Phase 4 Calculation Engine Suite", () => {
  it("Test 1: Calculates line subtotal, tax amount, and total with zero discount", () => {
    const line = CalculationEngine.calculateLine({
      quantity: 10,
      unitPrice: 25.5,
      taxRate: 10, // 10% tax
    });

    expect(line.subtotal).toBe(255.0);
    expect(line.discount).toBe(0);
    expect(line.taxAmount).toBe(25.5);
    expect(line.total).toBe(280.5);
  });

  it("Test 2: Calculates line discount with fixed amount discount", () => {
    const line = CalculationEngine.calculateLine({
      quantity: 5,
      unitPrice: 100,
      discount: 50, // $50 fixed discount
      taxRate: 5, // 5% tax
    });

    expect(line.subtotal).toBe(500.0);
    expect(line.discount).toBe(50.0);
    expect(line.taxAmount).toBe(22.5); // (500 - 50) * 5% = 22.5
    expect(line.total).toBe(472.5);
  });

  it("Test 3: Calculates line discount with percentage discount", () => {
    const line = CalculationEngine.calculateLine({
      quantity: 2,
      unitPrice: 150,
      discount: 10, // 10% discount
      discountIsPercentage: true,
      taxRate: 8, // 8% tax
    });

    expect(line.subtotal).toBe(300.0);
    expect(line.discount).toBe(30.0); // 300 * 10% = 30
    expect(line.taxAmount).toBe(21.6); // (300 - 30) * 8% = 21.6
    expect(line.total).toBe(291.6);
  });

  it("Test 4: Calculates document totals accurately and reconciles line totals", () => {
    const doc = CalculationEngine.calculateDocument([
      { quantity: 2, unitPrice: 100, discount: 10, taxRate: 5 }, // subtotal: 200, disc: 10, tax: 9.5, total: 199.5
      { quantity: 3, unitPrice: 50, taxRate: 10 }, // subtotal: 150, disc: 0, tax: 15, total: 165
    ]);

    expect(doc.subtotal).toBe(350.0);
    expect(doc.discountTotal).toBe(10.0);
    expect(doc.taxTotal).toBe(24.5);
    expect(doc.total).toBe(364.5);
    expect(doc.lines.length).toBe(2);
  });

  it("Test 5: Caps discount at line subtotal if discount exceeds subtotal", () => {
    const line = CalculationEngine.calculateLine({
      quantity: 1,
      unitPrice: 50,
      discount: 100, // Exceeds $50 subtotal
    });

    expect(line.subtotal).toBe(50.0);
    expect(line.discount).toBe(50.0);
    expect(line.total).toBe(0.0);
  });
});
