"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Receipt,
  CreditCard,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ExternalLink,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActivityItem {
  id: string;
  type: "INVOICE" | "EXPENSE" | "PAYMENT" | "BANK_TX";
  title: string;
  party: string;
  date: string;
  amount: number;
  status: string;
  href: string;
}

export interface RecentActivityListProps {
  activities: ActivityItem[];
}

export function RecentActivityList({ activities }: RecentActivityListProps) {
  const [filter, setFilter] = useState<"ALL" | "INVOICE" | "EXPENSE" | "BANK">("ALL");

  const filtered = activities.filter((act) => {
    if (filter === "ALL") return true;
    if (filter === "INVOICE") return act.type === "INVOICE";
    if (filter === "EXPENSE") return act.type === "EXPENSE";
    if (filter === "BANK") return act.type === "BANK_TX" || act.type === "PAYMENT";
    return true;
  });

  const getIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "INVOICE":
        return <FileText className="h-4 w-4 text-indigo-400" />;
      case "EXPENSE":
        return <Receipt className="h-4 w-4 text-rose-400" />;
      case "PAYMENT":
        return <CreditCard className="h-4 w-4 text-emerald-400" />;
      case "BANK_TX":
        return <Landmark className="h-4 w-4 text-sky-400" />;
    }
  };

  const getTypeBadge = (type: ActivityItem["type"]) => {
    switch (type) {
      case "INVOICE":
        return "bg-indigo-500/10 text-indigo-300 border-indigo-500/20";
      case "EXPENSE":
        return "bg-rose-500/10 text-rose-300 border-rose-500/20";
      case "PAYMENT":
        return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
      case "BANK_TX":
        return "bg-sky-500/10 text-sky-300 border-sky-500/20";
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl glass-card-3d p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4">
        <div>
          <h3 className="text-base font-bold text-white text-depth">
            Recent Financial Operations
          </h3>
          <p className="text-xs text-slate-400">
            Real-time multi-module transaction stream across sales, expenses, and banking.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 rounded-xl glass-surface p-1 border border-white/5">
          {(["ALL", "INVOICE", "EXPENSE", "BANK"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                filter === tab
                  ? "bg-indigo-600 text-white shadow-xs bevel-raised"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {tab === "ALL" ? "All" : tab === "INVOICE" ? "Invoices" : tab === "EXPENSE" ? "Expenses" : "Banking"}
            </button>
          ))}
        </div>
      </div>

      {/* Content List */}
      <div className="mt-4 divide-y divide-white/5">
        {filtered.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl glass-surface border border-white/10 text-indigo-400 mb-3 animate-float-3d">
              <Clock className="h-6 w-6 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">No recent operations</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Create customer invoices or record direct expenses to populate your transaction audit log.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link
                href="/invoices"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow-xs bevel-raised transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                New Invoice
              </Link>
              <Link
                href="/expenses/new"
                className="inline-flex items-center gap-1.5 rounded-lg glass-surface hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors border border-white/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Record Expense
              </Link>
            </div>
          </div>
        ) : (
          filtered.map((item) => {
            const isInflow = item.type === "INVOICE" || item.type === "PAYMENT";

            return (
              <div
                key={item.id}
                className="flex items-center justify-between py-3.5 hover:bg-white/[0.02] px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl glass-surface border border-white/10">
                    {getIcon(item.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white truncate font-mono">
                        {item.title}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.2 text-[9px] font-mono font-semibold border uppercase",
                          getTypeBadge(item.type)
                        )}
                      >
                        {item.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.party} &bull; {new Date(item.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-xs sm:text-sm font-bold font-mono",
                        isInflow ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {isInflow ? "+PKR " : "-PKR "}{Math.abs(item.amount).toFixed(2)}
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.status}
                    </span>
                  </div>
                  <Link
                    href={item.href}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                    aria-label={`View ${item.title}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
