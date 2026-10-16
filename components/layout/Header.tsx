"use client";

import * as React from "react";
import { SessionUser } from "@/types/auth";
import { Menu } from "lucide-react";
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
        <UserMenu user={user} />
      </div>
    </header>
  );
}
