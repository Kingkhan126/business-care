import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { DashboardService } from "@/server/services/DashboardService";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { FinancialOverviewChart } from "@/components/dashboard/FinancialOverviewChart";
import { BankingLiquidityPanel } from "@/components/dashboard/BankingLiquidityPanel";
import { RecentActivityList, type ActivityItem } from "@/components/dashboard/RecentActivityList";
import { HeroBanner } from "@/components/dashboard/HeroBanner";
import { TrendingUp, PieChart, Landmark, FileText, Receipt, Wallet } from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentSessionUser();
  if (!user || !user.activeOrganizationId) redirect("/login");
  const data = await DashboardService.getSummary(user);
  const { organization, access } = data;
  const format = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: organization.currency }).format(amount);
  const activities: ActivityItem[] = [
    ...data.invoices.map(inv => ({ id: `inv-${inv.id}`, type: "INVOICE" as const, title: inv.invoiceNumber, party: inv.customer.displayName, date: inv.issueDate.toISOString(), amount: Number(inv.total), status: inv.status, href: "/invoices" })),
    ...data.expenses.map(exp => ({ id: `exp-${exp.id}`, type: "EXPENSE" as const, title: exp.expenseNumber, party: exp.category?.name || "Expense", date: exp.expenseDate.toISOString(), amount: Number(exp.total), status: exp.status, href: `/expenses/${exp.id}` })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 8);
  return (
    <div className="space-y-6">
      <HeroBanner organizationName={organization.name} logoUrl={organization.logoUrl} roleName={user.roleName || "Member"} permissions={user.permissions} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {access.reports && <>
          <MetricCard title="Revenue" value={format(data.totalRevenue)} subtitle="All-time ledger revenue" icon={TrendingUp} accent="emerald" href="/accounting/profit-loss" />
          <MetricCard title="Expenses" value={format(data.totalExpenses)} subtitle="All-time ledger costs and expenses" icon={PieChart} accent="rose" href="/accounting/profit-loss" />
          <MetricCard title="Net Profit" value={format(data.netProfit)} subtitle="All-time ledger revenue less costs" icon={Wallet} accent="indigo" href="/accounting/profit-loss" />
        </>}
        {access.banking && <MetricCard title="Cash Balance" value={format(data.cash)} subtitle={`Active accounts in ${organization.currency}`} icon={Landmark} accent="sky" href="/banking" />}
        {access.invoices && <MetricCard title="Receivables" value={format(data.receivables)} subtitle={`Unpaid invoices in ${organization.currency}`} icon={FileText} accent="amber" href="/invoices" />}
        {access.expenses && <MetricCard title="Unpaid Expenses" value={format(data.unpaidExpenses)} subtitle={`Approved and posted obligations in ${organization.currency}`} icon={Receipt} accent="rose" href="/expenses" />}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {access.reports && <FinancialOverviewChart data={data.monthlyData} currency={organization.currency} />}
        {access.banking && <BankingLiquidityPanel accounts={data.accounts.map(a => ({ ...a, institutionName: a.institutionName || "Bank", accountNumberMasked: a.accountNumberMasked || "" }))} currency={organization.currency} totalBalance={data.cash} canTransfer={user.permissions.includes("banking.transfer")} canReconcile={user.permissions.includes("banking.reconcile")} />}
      </div>
      {(access.invoices || access.expenses) && <RecentActivityList activities={activities} currency={organization.currency} />}
      {!Object.values(access).some(Boolean) && <p className="rounded-xl border border-white/10 p-6 text-slate-300">Your workspace is ready. Ask your organization administrator for access to the modules you need.</p>}
    </div>
  );
}
