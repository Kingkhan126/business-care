import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invoiceLogoSource } from "@/lib/branding/invoice-logo";
import { InvoiceDocument, InvoiceDocumentData } from "@/components/invoices/InvoiceDocument";
import { printInvoice } from "@/lib/printing/print-invoice";

const invoice: InvoiceDocumentData = { id: "test", invoiceNumber: "INV-001", issueDate: "2026-10-16", status: "ISSUED", total: 500, amountPaid: 0, balanceDue: 500 };
afterEach(() => vi.unstubAllGlobals());

describe("Conditional invoice branding", () => {
  it.each([null, undefined, "", "  ", "javascript:alert(1)", "file:///logo.png", "broken-path", "data:text/html;base64,aGVsbG8=", "//example.test/logo.png", "/uploads/logos/../other/logo.png"])("omits unsupported logo reference %s without a placeholder", logoUrl => {
    expect(invoiceLogoSource(logoUrl)).toBeNull();
    const html = renderToStaticMarkup(React.createElement(InvoiceDocument, { invoice: { ...invoice, organization: { name: "Tenant", logoUrl } } }));
    expect(html).not.toContain("<img");
    expect(html).not.toContain("M38 10");
    expect(html).toContain("INV-001");
    expect(html).toContain("500.00");
  });

  it.each(["data:image/png;base64,aGVsbG8=", "/uploads/logos/tenant/logo.png?v=123", "https://images.example.test/logo.png"])("uses a supported persisted logo without an image optimizer: %s", logoUrl => {
    const html = renderToStaticMarkup(React.createElement(InvoiceDocument, { invoice: { ...invoice, organization: { name: "Tenant", logoUrl } } }));
    expect(html).toContain(`src="${logoUrl}"`);
    expect(html).toContain('alt="Tenant logo"');
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html.indexOf("data-invoice-logo")).toBeLessThan(html.indexOf("TAX INVOICE"));
  });

  it.each(["load", "error"])("waits for logo %s before opening print / PDF output", async event => {
    const image = new EventTarget();
    vi.stubGlobal("document", { querySelectorAll: vi.fn().mockReturnValue([image]) });
    const print = vi.fn();
    vi.stubGlobal("window", { print });
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => callback());
    const pending = printInvoice();
    expect(print).not.toHaveBeenCalled();
    image.dispatchEvent(new Event(event));
    await pending;
    expect(print).toHaveBeenCalledTimes(1);
  });
});
