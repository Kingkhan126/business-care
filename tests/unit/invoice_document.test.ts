import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvoiceDocument, InvoiceDocumentData } from "@/components/invoices/InvoiceDocument";
import { rupeesInWords } from "@/lib/printing/amount-in-words";

const invoice: InvoiceDocumentData = {
  id: "invoice", invoiceNumber: "INV-LIVE", issueDate: "2026-10-20T08:45:00Z", status: "PARTIALLY_PAID",
  subtotal: "100.00", discountTotal: "10.00", taxTotal: "16.20", total: "106.20", amountPaid: "50", balanceDue: "56.20",
  customer: { displayName: "Dynamic Customer", phone: "0300-1234567", billingCity: "Lahore", billingCountry: "Pakistan" },
  createdBy: { name: "Dynamic Cashier" }, notes: "Keep refrigerated", terms: "Custom agreed terms",
  lines: [{ description: "A very long dynamic medicine name", quantity: 2.5, unitPrice: 40, discount: 10, taxAmount: 16.2, total: 106.2, unitOfMeasure: "Strip" }],
  paymentAllocations: [{ payment: { status: "COMPLETED", paymentMethod: "BANK_TRANSFER", reference: "BANK-REF" } }, { payment: { status: "VOID", paymentMethod: "CASH", reference: "VOID-REF" } }],
};
const render = (data = invoice) => renderToStaticMarkup(React.createElement(InvoiceDocument, { invoice: data }));

describe("AD CARE invoice presentation", () => {
  it("renders live data, fractional quantities, completed payments and saved totals in PKR", () => {
    const html = render();
    for (const value of ["Dynamic Customer", "Dynamic Cashier", "INV-LIVE", "20-Oct-2026", "01:45 PM", "Lahore, Pakistan", "2.5", "Strip", "106.20", "56.20", "Bank Transfer", "BANK-REF", "Keep refrigerated", "Custom agreed terms", "Delivery All Over Pakistan", "PKR"]) expect(html).toContain(value);
    expect(html).not.toContain("VOID-REF");
    expect(html).not.toContain("$");
    expect(html).not.toContain("Dr. Ahmed Khan");
    expect(html).toContain("One Hundred Six Rupees and Twenty Paisas Only.");
  });
  it("uses persisted totals even when they differ from a display-side line sum", () => {
    const html = render({ ...invoice, subtotal: 432.10, discountTotal: 12.30, taxTotal: 4.56, total: 424.36 });
    for (const value of ["432.10", "12.30", "4.56", "424.36"]) expect(html).toContain(value);
  });
  it("does not fabricate customers, products or cash payments when information is missing", () => {
    const html = render({ id: "empty", invoiceNumber: "INV-EMPTY", issueDate: "invalid", status: "DRAFT", total: 0, amountPaid: 0, balanceDue: 0 });
    expect(html).toContain("No line items recorded.");
    expect(html).toContain("Not recorded");
    expect(html).not.toContain("nomi");
    expect(html).not.toContain("0347 9121852");
  });
  it.each([[0, "Zero Rupees Only."], [1.01, "One Rupee and One Paisa Only."], [30874.20, "Thirty Thousand Eight Hundred Seventy-Four Rupees and Twenty Paisas Only."], [999.999, "One Thousand Rupees Only."]])("spells PKR %s without changing the stored amount", (amount, words) => {
    expect(rupeesInWords(Number(amount))).toBe(words);
  });
});
