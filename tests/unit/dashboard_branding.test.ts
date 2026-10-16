import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeroBanner } from "@/components/dashboard/HeroBanner";
import { WorkspaceCurrencyContext, useWorkspaceCurrency } from "@/components/layout/WorkspaceCurrency";

describe("Workspace branding and currency", () => {
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
