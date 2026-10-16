import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeroBanner } from "@/components/dashboard/HeroBanner";
import { WorkspaceCurrencyContext, useWorkspaceCurrency } from "@/components/layout/WorkspaceCurrency";
import { RecentActivityList } from "@/components/dashboard/RecentActivityList";

describe("Workspace branding and currency", () => {
  it("shows draft invoice records and preserves each record's actual currency", () => {
    const activities = [
      { id: "draft", type: "INVOICE" as const, title: "INV-000005", party: "Customer", date: "2026-10-16", amount: 60, currency: "PKR", status: "DRAFT", href: "/invoices" },
      { id: "usd", type: "EXPENSE" as const, title: "EXP-USD", party: "Expense", date: "2026-10-16", amount: 12, currency: "USD", status: "DRAFT", href: "/expenses" },
    ];
    const html = renderToStaticMarkup(React.createElement(RecentActivityList, { activities, currency: "PKR" }));
    expect(html).toContain("INV-000005");
    expect(html).toContain("DRAFT");
    expect(html).toContain("PKR");
    expect(html).toContain("60.00");
    expect(html).toContain("USD");
    expect(html).toContain("Drafts do not affect financial totals");
  });
  it("shows the persisted logo with the organization name and opens branding settings", () => {
    const logoUrl = "data:image/png;base64,aGVsbG8=";
    const html = renderToStaticMarkup(React.createElement(HeroBanner, { organizationName: "Nouman", logoUrl, permissions: ["organization.update"] }));
    expect(html).toContain(`src="${logoUrl}"`);
    expect(html).toContain('alt="Nouman logo"');
    expect(html).toContain('href="/settings"');
    expect(html).not.toContain("/_next/image");
  });

  it("uses the saved business currency in child forms, including PKR", () => {
    function FormCurrency() { return React.createElement("span", null, useWorkspaceCurrency()); }
    for (const currency of ["PKR", "EUR"]) {
      const html = renderToStaticMarkup(React.createElement(WorkspaceCurrencyContext.Provider, { value: currency }, React.createElement(FormCurrency)));
      expect(html).toBe(`<span>${currency}</span>`);
    }
  });
});
