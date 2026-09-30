import * as React from "react";
import Link from "next/link";
import { Building2, Users, ShieldCheck, Plus, Sparkles, Receipt, FileText } from "lucide-react";

export interface HeroBannerProps {
  organizationName: string;
  tenantId?: string;
  roleName?: string;
  userName?: string;
  userEmail?: string;
}

export function HeroBanner({
  organizationName,
  tenantId,
  roleName = "Owner",
  userName,
  userEmail,
}: HeroBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl glass-card-3d p-6 sm:p-8 border border-indigo-500/20 shadow-glow-indigo">
      {/* Background radial lighting */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-indigo-950/80" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Column: Organization Title & Status */}
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 text-xs font-semibold text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Phase 7 Certified Operational
            </span>
            {tenantId && (
              <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] font-mono text-slate-300">
                Tenant: {tenantId.substring(0, 10)}...
              </span>
            )}
            <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-[11px] font-semibold text-indigo-300">
              Role: {roleName}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white text-depth">
            {organizationName}
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
            Financial command center is active. Multi-tenant double-entry ledger, multi-currency banking, and automated expense reconciliation are verified and operational.
          </p>
        </div>

        {/* Right Column: Fast Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/invoices"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bevel-raised hover:from-indigo-400 hover:to-indigo-600 hover:shadow-glow-indigo transition-all duration-150"
          >
            <FileText className="h-4 w-4" />
            Create Invoice
          </Link>

          <Link
            href="/expenses/new"
            className="inline-flex items-center gap-2 rounded-xl glass-surface border border-white/10 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all duration-150"
          >
            <Receipt className="h-4 w-4 text-rose-400" />
            Record Expense
          </Link>

          <Link
            href="/organization"
            className="inline-flex items-center gap-2 rounded-xl glass-surface border border-white/10 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-all duration-150"
            title="Organization Settings"
          >
            <Building2 className="h-4 w-4 text-indigo-400" />
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
