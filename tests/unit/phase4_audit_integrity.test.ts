import { describe, it, expect } from "vitest";
import { CalculationEngine } from "@/server/services/CalculationEngine";

describe("Phase 4 Financial Integrity & Calculation Engine Suite", () => {
  it("should calculate exact monetary lines with zero floating-point micro-cent leakage", () => {
    // 0.1 + 0.2 floating point check
    const line1 = CalculationEngine.calculateLine({
      description: "Item 1",
      quantity: 0.1,
      unitPrice: 0.2,
      taxRate: 10,
    });

    expect(line1.subtotal).toBe(0.02);
    expect(line1.taxAmount).toBe(0.0);
    expect(line1.total).toBe(0.02);

    const doc = CalculationEngine.calculateDocument([
      { description: "Line 1", quantity: 3, unitPrice: 19.99, discount: 10, discountIsPercentage: true, taxRate: 8.5 },
      { description: "Line 2", quantity: 2.5, unitPrice: 100, discount: 5, discountIsPercentage: false, taxRate: 0 },
    ]);

    expect(doc.subtotal).toBe(309.97); // 59.97 + 250
    expect(doc.discountTotal).toBe(11.0); // 6.00 + 5.00
    expect(doc.taxTotal).toBe(4.59); // (53.97 * 0.085) = 4.58745 -> 4.59
    expect(doc.total).toBe(303.56); // (53.97 + 4.59) + 245 = 303.56
  });

  it("should enforce discount cap at line subtotal level", () => {
    const line = CalculationEngine.calculateLine({
      description: "Over-discounted item",
      quantity: 1,
      unitPrice: 50,
      discount: 100, // Discount exceeds subtotal
    });

    expect(line.discount).toBe(50);
    expect(line.subtotal).toBe(50);
    expect(line.total).toBe(0);
  });

  it("should handle zero price and zero quantity gracefully without NaN", () => {
    const line = CalculationEngine.calculateLine({
      description: "Free sample",
      quantity: 0,
      unitPrice: 0,
    });

    expect(line.subtotal).toBe(0);
    expect(line.taxAmount).toBe(0);
    expect(line.total).toBe(0);
    expect(Number.isNaN(line.total)).toBe(false);
  });
});
