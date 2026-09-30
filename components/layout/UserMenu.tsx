"use client";

import * as React from "react";
import { SessionUser } from "@/types/auth";
import { getInitials } from "@/lib/utils";
import { LogOut, User as UserIcon, Shield, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function UserMenu({ user }: { user: SessionUser }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 rounded-full p-1 text-slate-300 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white shadow-glow-indigo">
          {getInitials(user.name)}
        </div>
        <span className="hidden text-xs font-medium text-slate-300 sm:inline-block">
          {user.name}
        </span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-slate-500 sm:inline-block" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl glass-panel p-1.5 shadow-glass-lg">
            <div className="border-b border-white/5 px-3 py-2">
              <p className="text-sm font-semibold text-slate-200">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
              {user.roleName && (
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-indigo-500/15 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                  <Shield className="h-3 w-3" />
                  {user.roleName}
                </div>
              )}
            </div>

            <div className="py-1">
              <Link
                href="/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
              >
                <UserIcon className="h-4 w-4 text-slate-500" />
                Account Settings
              </Link>
            </div>

            <div className="border-t border-white/5 pt-1">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
