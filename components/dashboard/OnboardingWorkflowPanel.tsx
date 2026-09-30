import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Building2, Users, ArrowRight, Sparkles } from "lucide-react";

export interface OnboardingWorkflowPanelProps {
  currency: string;
  timezone: string;
}

export function OnboardingWorkflowPanel({
  currency,
  timezone,
}: OnboardingWorkflowPanelProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl glass-card-3d p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Sparkles className="h-4 w-4 drop-shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white text-depth">
              Enterprise Initialization Workflow
            </h3>
            <p className="text-xs text-slate-400">
              Verify foundation readiness and multi-tenant organizational structure.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold">
            1 of 3 Completed (33%)
          </span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)] transition-all duration-500" />
      </div>

      {/* 3 Workflow Steps */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {/* Step 1: Completed */}
        <div className="relative overflow-hidden rounded-xl bg-slate-900/60 border border-emerald-500/20 p-4 shadow-[inset_0_1px_0_rgba(16,185,129,0.15)]">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold tracking-wider">
                  Step 1 &bull; Active
                </span>
              </div>
              <h4 className="text-xs font-bold text-white mt-0.5">
                Core Foundation
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                PostgreSQL schema, General Ledger, and RBAC initialized.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Next in Progress (Elevated 3D) */}
        <Link
          href="/organization"
          className="group relative overflow-hidden rounded-xl glass-card-3d p-4 border border-indigo-500/30 hover:border-indigo-500/50 shadow-glow-indigo transition-all duration-200"
        >
          <div className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent opacity-60" />
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 group-hover:scale-105 transition-transform">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold tracking-wider">
                  Step 2 &bull; Action Required
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-indigo-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <h4 className="text-xs font-bold text-white mt-0.5 group-hover:text-indigo-200 transition-colors">
                Business Profile
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Tax ID, address, currency ({currency}), and timezone ({timezone}).
              </p>
            </div>
          </div>
        </Link>

        {/* Step 3: Future / Team */}
        <Link
          href="/users"
          className="group relative overflow-hidden rounded-xl glass-surface p-4 border border-white/5 hover:border-white/15 transition-all duration-200"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-400 group-hover:text-white transition-colors">
              <Users className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
                  Step 3 &bull; Pending
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-1 group-hover:text-white transition-all" />
              </div>
              <h4 className="text-xs font-bold text-slate-200 mt-0.5 group-hover:text-white transition-colors">
                Team &amp; Access Controls
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Invite financial controllers, accountants, and staff members.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
