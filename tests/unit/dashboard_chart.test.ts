import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FinancialOverviewChart } from "@/components/dashboard/FinancialOverviewChart";

describe("Financial chart display", () => {
  it("uses the supplied organization currency in every summary", () => {
    const html = renderToStaticMarkup(React.createElement(FinancialOverviewChart, { currency: "EUR", data: [{ label: "Oct", fullLabel: "October 2026", revenue: 250, expenses: 100 }] }));
    expect(html).toContain("EUR");
    expect(html).not.toContain("PKR");
    expect(html).toContain("Net Profit");
  });
  it("represents reversal months below zero instead of clamping them away", () => {
    const html = renderToStaticMarkup(React.createElement(FinancialOverviewChart, { currency: "USD", data: [{ label: "Sep", fullLabel: "September 2026", revenue: 250, expenses: 100 }, { label: "Oct", fullLabel: "October 2026", revenue: -250, expenses: -100 }] }));
    expect(html).toContain("-500");
    expect(html).not.toContain("NaN");
  });
});
