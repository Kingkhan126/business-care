import { FutureDomainPlaceholder } from "@/components/shared/FutureDomainPlaceholder";

export default function ReportsPage() {
  return (
    <FutureDomainPlaceholder
      title="Financial & Operational Reporting"
      domainName="Reports"
      targetPhase="Phase 5 Scope"
      description="Generate Profit & Loss (Income Statement), Balance Sheet, Cash Flow Statement, and Aging reports."
      plannedFeatures={[
        "Profit & Loss (Income Statement)",
        "Balance Sheet & General Ledger Reports",
        "Accounts Receivable (A/R) & Accounts Payable (A/P) Aging",
        "Sales by Product & Customer Analytics",
        "Export to PDF, Excel, and CSV",
      ]}
    />
  );
}
