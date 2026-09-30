import { FutureDomainPlaceholder } from "@/components/shared/FutureDomainPlaceholder";

export default function PurchasesPage() {
  return (
    <FutureDomainPlaceholder
      title="Purchase Orders & Procurement"
      domainName="Purchases"
      targetPhase="Phase 3 Scope"
      description="Issue purchase orders to suppliers, track item receipts, and manage incoming stock shipments."
      plannedFeatures={[
        "Purchase Order Creation & Approval Workflow",
        "Goods Received Notes (GRN)",
        "Purchase Order Status Tracking",
        "Cost Allocation & Landing Costs",
      ]}
    />
  );
}
