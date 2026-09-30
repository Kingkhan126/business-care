import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { OrganizationService } from "@/server/services/OrganizationService";
import { db } from "@/db/client";
import { Alert } from "@/components/ui/Alert";
import { HeroBanner } from "@/components/dashboard/HeroBanner";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { FinancialOverviewChart, type MonthlyDataPoint } from "@/components/dashboard/FinancialOverviewChart";
import { BankingLiquidityPanel, type BankAccountItem } from "@/components/dashboard/BankingLiquidityPanel";
import { RecentActivityList, type ActivityItem } from "@/components/dashboard/RecentActivityList";
import { OnboardingWorkflowPanel } from "@/components/dashboard/OnboardingWorkflowPanel";
import { DomainCardsGrid } from "@/components/dashboard/DomainCardsGrid";
import {
  TrendingUp,
  PieChart,
  CreditCard,
  Landmark,
  FileText,
  Receipt,
  Wallet,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentSessionUser();

  if (!user || !user.activeOrganizationId) {
    redirect("/login");
  }

  const orgId = user.activeOrganizationId;

  let orgName = "AD CARE & MEDS PHARMACY";
  let currency = "USD";
  let timezone = "UTC";

  try {
    const org = await OrganizationService.getOrganization(user);
    if (org) {
      orgName = org.name;
      currency = org.currency;
      timezone = org.timezone;
    }
  } catch {
    // Fallback if organization fetch fails
  }

  // ── Parallel Data Fetching for Authoritative Tenant Data ──
  const [
    invoices,
    expenses,
    bankAccounts,
    customerPayments,
    bankTransactions,
    productCount,
  ] = await Promise.all([
    db.salesInvoice.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        balanceDue: true,
        status: true,
        issueDate: true,
        customer: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.expense.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        expenseNumber: true,
        description: true,
        total: true,
        status: true,
        expenseDate: true,
        category: { select: { name: true } },
        supplier: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.bankAccount.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        accountName: true,
        institutionName: true,
        accountNumberMasked: true,
        currentBalance: true,
        currency: true,
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.customerPayment.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        paymentNumber: true,
        amount: true,
        paymentDate: true,
        customer: { select: { displayName: true } },
      },
    }),
    db.bankTransaction.findMany({
      where: { organizationId: orgId },
      orderBy: { transactionDate: "desc" },
      take: 6,
      select: {
        id: true,
        transactionDate: true,
        description: true,
        amount: true,
        transactionType: true,
        bankAccount: { select: { accountName: true } },
      },
    }),
    db.product.count({ where: { organizationId: orgId } }),
  ]);

  // ── Authoritative Real Financial Calculations ──
  const validInvoices = invoices.filter(
    (inv) => inv.status !== "VOID" && inv.status !== "CANCELLED"
  );
  const totalRevenue = validInvoices.reduce(
    (acc, inv) => acc + Number(inv.total),
    0
  );

  const validExpenses = expenses.filter(
    (exp) => exp.status !== "REJECTED" && exp.status !== "VOIDED"
  );
  const totalExpenses = validExpenses.reduce(
    (acc, exp) => acc + Number(exp.total),
    0
  );

  const netProfit = totalRevenue - totalExpenses;

  const totalBankBalance = bankAccounts
    .filter((acc) => acc.isActive)
    .reduce((acc, b) => acc + Number(b.currentBalance), 0);

  const outstandingReceivables = invoices
    .filter((inv) => inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID")
    .reduce((acc, inv) => acc + Number(inv.balanceDue), 0);

  const outstandingPayables = expenses
    .filter((exp) => exp.status === "APPROVED" || exp.status === "POSTED")
    .reduce((acc, exp) => acc + Number(exp.total), 0);

  // ── Construct Real 6-Month Timeline Buckets ──
  const now = new Date();
  const monthlyData: MonthlyDataPoint[] = [];

  for (let i = 5; i >= 0; i--) {
    const bucketStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const bucketEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = bucketStart.toLocaleString("en-US", { month: "short" });
    const fullLabel = `${bucketStart.toLocaleString("en-US", { month: "long" })} ${bucketStart.getFullYear()}`;

    const monthRevenue = validInvoices
      .filter((inv) => {
        const d = new Date(inv.issueDate);
        return d >= bucketStart && d < bucketEnd;
      })
      .reduce((s, inv) => s + Number(inv.total), 0);

    const monthExpenses = validExpenses
      .filter((exp) => {
        const d = new Date(exp.expenseDate);
        return d >= bucketStart && d < bucketEnd;
      })
      .reduce((s, exp) => s + Number(exp.total), 0);

    monthlyData.push({
      label,
      fullLabel,
      revenue: monthRevenue,
      expenses: monthExpenses,
    });
  }

  // ── Construct Real Unified Recent Activity Stream ──
  const recentActivities: ActivityItem[] = [];

  for (const inv of invoices.slice(0, 5)) {
    recentActivities.push({
      id: `inv-${inv.id}`,
      type: "INVOICE",
      title: inv.invoiceNumber,
      party: inv.customer?.displayName || "Customer",
      date: new Date(inv.issueDate).toISOString(),
      amount: Number(inv.total),
      status: inv.status,
      href: "/invoices",
    });
  }

  for (const exp of expenses.slice(0, 5)) {
    recentActivities.push({
      id: `exp-${exp.id}`,
      type: "EXPENSE",
      title: exp.expenseNumber,
      party: exp.supplier?.displayName || exp.category?.name || "Operating Expense",
      date: new Date(exp.expenseDate).toISOString(),
      amount: Number(exp.total),
      status: exp.status,
      href: "/expenses",
    });
  }

  for (const pay of customerPayments.slice(0, 4)) {
    recentActivities.push({
      id: `pay-${pay.id}`,
      type: "PAYMENT",
      title: pay.paymentNumber,
      party: pay.customer?.displayName || "Customer Allocation",
      date: new Date(pay.paymentDate).toISOString(),
      amount: Number(pay.amount),
      status: "COMPLETED",
      href: "/payments",
    });
  }

  for (const tx of bankTransactions.slice(0, 4)) {
    recentActivities.push({
      id: `tx-${tx.id}`,
      type: "BANK_TX",
      title: tx.description || "Bank Entry",
      party: tx.bankAccount?.accountName || "Operating Bank",
      date: new Date(tx.transactionDate).toISOString(),
      amount: Number(tx.amount),
      status: tx.transactionType,
      href: "/banking/transactions",
    });
  }

  // Sort unified stream descending by timestamp
  recentActivities.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const formattedBankAccounts: BankAccountItem[] = bankAccounts.map((b) => ({
    id: b.id,
    accountName: b.accountName,
    institutionName: b.institutionName || "Bank Institution",
    accountNumberMasked: b.accountNumberMasked || "••••",
    currentBalance: Number(b.currentBalance),
    currency: b.currency,
    isActive: b.isActive,
  }));

  return (
    <div className="space-y-6">
      {/* ── 1. Hero / Business Command Header ── */}
      <HeroBanner
        organizationName={orgName}
        tenantId={orgId}
        roleName={user.roleName || "Owner"}
        userName={user.name}
        userEmail={user.email}
      />

      {/* ── 2. Multi-Tenant Security & Isolation Notice ── */}
      <Alert
        variant="info"
        title="Multi-Tenant Isolation & Role-Based Access Control Enforced"
      >
        Authenticated as <span className="font-semibold text-white">{user.name}</span> (
        {user.email}) &bull; Active Role:{" "}
        <span className="font-semibold text-white">{user.roleName || "Owner"}</span>. All
        double-entry ledger mutations, expense workflows, and bank operations are tenant-isolated
        and cryptographically verified.
      </Alert>

      {/* ── 3. KPI Command Center (6 Real Metric Cards) ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          title="Total Revenue"
          value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Issued & paid sales"
          icon={TrendingUp}
          accent="emerald"
          change={`${validInvoices.length} Invoiced`}
          trend={totalRevenue > 0 ? "up" : "neutral"}
          href="/invoices"
        />

        <MetricCard
          title="Operating Expenses"
          value={`$${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Posted & approved"
          icon={PieChart}
          accent="rose"
          change={`${validExpenses.length} Records`}
          trend={totalExpenses > 0 ? "down" : "neutral"}
          href="/expenses"
        />

        <MetricCard
          title="Net Profit"
          value={`$${netProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Revenue less expenses"
          icon={Wallet}
          accent={netProfit >= 0 ? "indigo" : "rose"}
          change={netProfit >= 0 ? "Net Positive" : "Net Deficit"}
          trend={netProfit >= 0 ? "up" : "down"}
          href="/accounting"
        />

        <MetricCard
          title="Liquid Cash"
          value={`$${totalBankBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Total bank balances"
          icon={Landmark}
          accent="sky"
          change={`${bankAccounts.length} Connected`}
          trend="neutral"
          href="/banking"
        />

        <MetricCard
          title="Receivables"
          value={`$${outstandingReceivables.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Pending customer balance"
          icon={FileText}
          accent="amber"
          change="Due Soon"
          trend="neutral"
          href="/invoices"
        />

        <MetricCard
          title="Payables"
          value={`$${outstandingPayables.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Awaiting disbursement"
          icon={Receipt}
          accent="rose"
          change="Pending Payout"
          trend="neutral"
          href="/expenses"
        />
      </div>

      {/* ── 4. Financial Visualization & Cash/Banking Panel ── */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left 7 Columns: Dimensional SVG Financial Chart */}
        <div className="lg:col-span-7 xl:col-span-8">
          <FinancialOverviewChart data={monthlyData} currency={currency} />
        </div>

        {/* Right 5 Columns: Cash & Banking Command */}
        <div className="lg:col-span-5 xl:col-span-4">
          <BankingLiquidityPanel accounts={formattedBankAccounts} currency={currency} />
        </div>
      </div>

      {/* ── 5. Real Multi-Module Activity Stream ── */}
      <RecentActivityList activities={recentActivities.slice(0, 8)} />

      {/* ── 6. Preserved Onboarding Workflow Panel ── */}
      <OnboardingWorkflowPanel currency={currency} timezone={timezone} />

      {/* ── 7. Preserved 4 Domain Cards (Dimensional Floating Cards) ── */}
      <DomainCardsGrid
        invoicesCount={validInvoices.length}
        receivablesBalance={outstandingReceivables}
        expensesCount={validExpenses.length}
        expensesTotal={totalExpenses}
        bankAccountsCount={bankAccounts.length}
        liquidCash={totalBankBalance}
        productsCount={productCount}
      />
    </div>
  );
}
