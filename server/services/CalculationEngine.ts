import { Prisma } from "@prisma/client";

export interface LineInput {
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // Fixed amount discount or percentage
  discountIsPercentage?: boolean;
  taxRate?: number; // Percentage, e.g. 10 for 10%
}

export interface CalculatedLine {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  total: number;
}

export interface CalculatedDocument {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  lines: CalculatedLine[];
}

export class CalculationEngine {
  /**
   * Explicit Accounting Rounding Policy:
   * - Monetary amounts are calculated using Prisma.Decimal arbitrary-precision arithmetic.
   * - Monetary values are rounded to 2 decimal places using HALF_UP rounding (Prisma.Decimal.ROUND_HALF_UP).
   * - Quantity values are rounded to 4 decimal places using HALF_UP rounding.
   */
  public static roundMoney(val: number | string | Prisma.Decimal): number {
    const dec = new Prisma.Decimal(val);
    return dec.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  }

  public static roundQuantity(val: number | string | Prisma.Decimal): number {
    const dec = new Prisma.Decimal(val);
    return dec.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  }

  public static toDecimal(val: number | string | Prisma.Decimal, places = 2): Prisma.Decimal {
    return new Prisma.Decimal(val).toDecimalPlaces(places, Prisma.Decimal.ROUND_HALF_UP);
  }

  /**
   * Calculates financial line item details using Decimal math.
   */
  public static calculateLine(input: LineInput): CalculatedLine {
    const qtyDec = this.toDecimal(input.quantity, 4);
    const priceDec = this.toDecimal(input.unitPrice, 2);
    const subtotalDec = qtyDec.mul(priceDec).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    let discountDec = input.discount ? this.toDecimal(input.discount, 2) : new Prisma.Decimal(0);
    if (input.discountIsPercentage && input.discount) {
      discountDec = subtotalDec
        .mul(new Prisma.Decimal(input.discount))
        .div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    }

    // Discount cannot exceed line subtotal
    if (discountDec.gt(subtotalDec)) {
      discountDec = subtotalDec;
    }

    const taxableDec = subtotalDec.sub(discountDec).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const taxRate = input.taxRate || 0;
    const taxAmountDec = taxableDec
      .mul(new Prisma.Decimal(taxRate))
      .div(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const totalDec = taxableDec.add(taxAmountDec).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    return {
      description: input.description || "",
      quantity: qtyDec.toNumber(),
      unitPrice: priceDec.toNumber(),
      discount: discountDec.toNumber(),
      taxRate,
      taxAmount: taxAmountDec.toNumber(),
      subtotal: subtotalDec.toNumber(),
      total: totalDec.toNumber(),
    };
  }

  /**
   * Calculates full document totals from a collection of line items.
   */
  public static calculateDocument(lines: LineInput[]): CalculatedDocument {
    const calculatedLines = lines.map((l) => this.calculateLine(l));

    let subtotalDec = new Prisma.Decimal(0);
    let discountDec = new Prisma.Decimal(0);
    let taxDec = new Prisma.Decimal(0);
    let totalDec = new Prisma.Decimal(0);

    for (const line of calculatedLines) {
      subtotalDec = subtotalDec.add(new Prisma.Decimal(line.subtotal));
      discountDec = discountDec.add(new Prisma.Decimal(line.discount));
      taxDec = taxDec.add(new Prisma.Decimal(line.taxAmount));
      totalDec = totalDec.add(new Prisma.Decimal(line.total));
    }

    return {
      subtotal: subtotalDec.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber(),
      discountTotal: discountDec.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber(),
      taxTotal: taxDec.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber(),
      total: totalDec.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber(),
      lines: calculatedLines,
    };
  }
}
