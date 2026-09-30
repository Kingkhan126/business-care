"use client";

import * as React from "react";
import Link from "next/link";
import { Landmark, ArrowUpRight, Plus, ShieldCheck, Wallet } from "lucide-react";

export interface BankAccountItem {
  id: string;
  accountName: string;
  institutionName: string;
  accountNumberMasked: string;
  currentBalance: number;
  currency: string;
  isActive: boolean;
}

export interface BankingLiquidityPanelProps {
  accounts: BankAccountItem[];
  currency?: string;
}

export function BankingLiquidityPanel({
  accounts,
  currency = "USD",
}: BankingLiquidityPanelProps) {
  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);

  return (
    <div className="relative overflow-hidden rounded-2xl glass-card-3d p-6 flex flex-col justify-between">
      {/* Top light shimmer */}
      <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-sky-500/10 via-transparent to-transparent opacity-50" />

      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Landmark className="h-5 w-5 drop-shadow-[0_0_6px_rgba(14,165,233,0.5)]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white text-depth">
                Cash &amp; Banking Command
              </h3>
              <p className="text-xs text-slate-400">
                Phase 6 Multi-Account Banking Engine
              </p>
            </div>
          </div>
          <Link
            href="/banking/accounts"
            className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors border border-white/10"
          >
            Manage
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Total Liquidity Callout */}
        <div className="my-4 rounded-xl glass-surface p-4 border border-white/5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Total Operational Liquidity
          </span>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white text-depth">
              PKR {totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
              <ShieldCheck className="h-3 w-3" />
              {accounts.length} Active {accounts.length === 1 ? "Account" : "Accounts"}
            </span>
          </div>
        </div>

        {/* Accounts Breakdown List */}
        <div className="space-y-2.5">
          {accounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-400 mb-2">
                <Wallet className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-slate-300">No bank accounts linked yet</p>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs mx-auto">
                Connect your operating bank accounts to automate reconciliations and monitor cash flows.
              </p>
              <div className="mt-3">
                <Link
                  href="/banking/accounts"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600/80 hover:bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Link Account
                </Link>
              </div>
            </div>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between rounded-xl glass-surface p-3 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 font-bold text-xs border border-sky-500/20 font-mono">
                    {acc.institutionName.charAt(0) || "B"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      {acc.accountName}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {acc.institutionName} &bull; {acc.accountNumberMasked}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold font-mono text-white">
                    PKR {acc.currentBalance.toFixed(2)}
                  </p>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {acc.currency}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Action Footer */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
        <Link
          href="/banking/transfers"
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
        >
          Internal Transfer &rarr;
        </Link>
        <Link
          href="/banking/reconciliation"
          className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          Reconcile Ledger &rarr;
        </Link>
      </div>
    </div>
  );
}
