"use client";

import * as React from "react";
import { SessionUser } from "@/types/auth";
import { Menu, Search, Bell, ShieldCheck } from "lucide-react";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import { UserMenu } from "./UserMenu";

export interface HeaderProps {
  user: SessionUser;
  onToggleMobileSidebar: () => void;
  organizationName?: string;
  currency?: string;
}

export function Header({
  user,
  onToggleMobileSidebar,
  organizationName,
  currency,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-indigo-500/15 glass-panel px-4 sm:px-6 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="rounded-xl p-2 text-slate-400 hover:bg-white/5 lg:hidden focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-colors"
          aria-label="Open mobile menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <OrganizationSwitcher
          organizationName={organizationName}
          currency={currency}
        />
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Search — recessed 3D trough */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="search"
            placeholder="Search ledger, invoices, payables..."
            className="h-9 w-72 rounded-xl border border-white/10 glass-input pl-10 pr-4 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
            readOnly
          />
        </div>

        {/* Multi-Tenant Security Badge */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-mono text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>SOC-2 Ready</span>
        </div>

        {/* Notifications Icon with Breathing Glow Dot */}
        <button
          className="relative rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-colors"
          aria-label="View notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-slate-900 shadow-glow-indigo animate-pulse" />
        </button>

        <div className="h-5 w-px bg-white/10" />

        <UserMenu user={user} />
      </div>
    </header>
  );
}
