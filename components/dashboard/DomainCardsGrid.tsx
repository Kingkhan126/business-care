import * as React from "react";
import Link from "next/link";
import {
  TrendingUp,
  PieChart,
  CreditCard,
  Boxes,
  ArrowRight,
} from "lucide-react";

export interface DomainCardsGridProps {
  invoicesCount: number;
  receivablesBalance: number;
  expensesCount: number;
  expensesTotal: number;
  bankAccountsCount: number;
  liquidCash: number;
  productsCount: number;
}

export function DomainCardsGrid({
  invoicesCount,
  receivablesBalance,
  expensesCount,
  expensesTotal,
  bankAccountsCount,
  liquidCash,
  productsCount,
}: DomainCardsGridProps) {
  const cards = [
    {
      title: "Sales & Receivables",
      href: "/invoices",
      icon: TrendingUp,
      value: `PKR ${receivablesBalance.toFixed(2)}`,
      badge: `${invoicesCount} Invoices`,
      description: "Sales invoices, receivables ledger, and customer payment allocations.",
      accent: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    },
    {
      title: "Expenses & Payables",
      href: "/expenses",
      icon: PieChart,
      value: `PKR ${expensesTotal.toFixed(2)}`,
      badge: `${expensesCount} Records`,
      description: "Operating expenditures, employee reimbursement claims, and approval workflows.",
      accent: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    },
    {
      title: "Cash Flow & Banking",
      href: "/banking",
      icon: CreditCard,
      value: `PKR ${liquidCash.toFixed(2)}`,
      badge: `${bankAccountsCount} Accounts`,
      description: "Multi-currency bank accounts, statement reconciliation, and cash transactions.",
      accent: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    },
    {
      title: "Inventory Value",
      href: "/inventory",
      icon: Boxes,
      value: `${productsCount} Items`,
      badge: "Catalog Active",
      description: "Stock tracking, FIFO revaluation, warehouses, and product master data.",
      accent: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Link
            key={card.title}
            href={card.href}
            className="group relative overflow-hidden rounded-2xl glass-card-3d p-5 flex flex-col justify-between"
          >
            {/* Top light shimmer */}
            <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-white/10 via-transparent to-transparent opacity-40 group-hover:opacity-70 transition-opacity" />

            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {card.title}
                </span>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border ${card.accent}`}
                >
                  <Icon className="h-4 w-4 drop-shadow-[0_0_6px_currentColor]" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="text-xl sm:text-2xl font-bold font-mono text-white text-depth">
                  {card.value}
                </span>
                <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                  {card.badge}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-400 leading-relaxed line-clamp-2">
                {card.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 group-hover:text-white transition-colors">
              <span className="text-[11px] font-medium">Open Module</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform text-indigo-400" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
