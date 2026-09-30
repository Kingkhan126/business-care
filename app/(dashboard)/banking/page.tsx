"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Landmark,
  Wallet,
  ArrowLeftRight,
  Sparkles,
  CheckCircle2,
  UploadCloud,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Plus,
  RefreshCw,
  CreditCard,
} from "lucide-react";

export default function BankingDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchPosition = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/banking/cash-position");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (e) {
      console.error("Failed to load cash position", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosition();
  }, []);

  const modules = [
    {
      title: "Bank & Cash Accounts",
      description: "Manage checking, savings, cash registers, credit cards, and linked general ledger accounts.",
      href: "/banking/accounts",
      icon: Landmark,
      color: "bg-blue-600",
    },
    {
      title: "Transaction Register",
      description: "Explore all historical bank and cash transactions with real-time status and categorization.",
      href: "/banking/transactions",
      icon: Wallet,
      color: "bg-indigo-600",
    },
    {
      title: "Inter-Account Transfers",
      description: "Atomic transfers between accounts with automatic fee posting and balanced double-entry journals.",
      href: "/banking/transfers",
      icon: ArrowLeftRight,
      color: "bg-emerald-600",
    },
    {
      title: "Transaction Matching Hub",
      description: "Smart candidate matching against customer payments, vendor payments, and general ledger journals.",
      href: "/banking/matching",
      icon: Sparkles,
      color: "bg-purple-600",
      badge: data?.unmatchedTransactionsCount ? `${data.unmatchedTransactionsCount} Unmatched` : undefined,
    },
    {
      title: "Bank Reconciliation",
      description: "Reconcile operational bank statements with zero-difference enforcement and immutable locks.",
      href: "/banking/reconciliation",
      icon: CheckCircle2,
      color: "bg-teal-600",
      badge: data?.openReconciliationsCount ? `${data.openReconciliationsCount} Active` : undefined,
    },
    {
      title: "Statement Import Wizard",
      description: "Upload CSV bank statements with flexible column mappings and fingerprint-based deduplication.",
      href: "/banking/import",
      icon: UploadCloud,
      color: "bg-amber-600",
    },
  ];

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Landmark className="h-7 w-7 text-indigo-600" />
            Banking & Cash Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time cash position, statement imports, smart matching, and audited bank reconciliations.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPosition}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/banking/transfers"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <ArrowLeftRight className="h-4 w-4" />
            New Transfer
          </Link>
          <Link
            href="/banking/accounts"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Add Account
          </Link>
        </div>
      </div>

      {/* KPI Liquidity Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Net Liquidity
            </span>
            <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              PKR {loading ? "..." : (data?.netLiquidity ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">Cash + Bank - Credit Cards</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Bank Accounts
            </span>
            <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Landmark className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              PKR {loading ? "..." : (data?.totalBank ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">Checking & Savings Operational Total</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cash on Hand
            </span>
            <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              PKR {loading ? "..." : (data?.totalCash ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">Cash registers and petty cash</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Attention Required
            </span>
            <div className="h-9 w-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {loading ? "..." : (data?.unmatchedTransactionsCount ?? 0)}
            </div>
            <p className="text-xs text-purple-600 font-medium mt-1">
              Unmatched bank transactions awaiting action
            </p>
          </div>
        </div>
      </div>

      {/* Accounts Quick Cards */}
      {data?.accounts && data.accounts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Active Accounts Overview</h2>
            <Link href="/banking/accounts" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              View all ({data.accounts.length}) &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.accounts.slice(0, 3).map((acc: any) => (
              <div key={acc.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-indigo-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{acc.accountName}</h3>
                    <p className="text-xs text-slate-500">{acc.institutionName || acc.accountType}</p>
                  </div>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {acc.accountType}
                  </span>
                </div>
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-xs text-slate-500">Balance:</span>
                  <span className="text-lg font-bold text-slate-900">
                    {acc.currency || "PKR"} {acc.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 truncate max-w-[150px]">
                    GL: {acc.linkedLedgerAccountName || "Not Linked"}
                  </span>
                  <Link href={`/banking/accounts/${acc.id}`} className="text-indigo-600 font-medium hover:underline">
                    Register &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Navigation Modules Grid */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Banking Modules & Workflows</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group relative bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`h-11 w-11 rounded-lg ${mod.color} text-white flex items-center justify-center shadow-xs`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    {mod.badge && (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {mod.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    {mod.description}
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                  Launch workflow <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
