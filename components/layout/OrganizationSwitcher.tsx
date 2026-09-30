"use client";

import * as React from "react";
import { Building2, ChevronDown, Check, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export interface OrganizationOption {
  id: string;
  name: string;
  currency: string;
  roleName?: string;
}

export interface OrganizationSwitcherProps {
  organizationName?: string;
  currency?: string;
}

export function OrganizationSwitcher({
  organizationName = "Acme Global Enterprises",
  currency = "USD",
}: OrganizationSwitcherProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [organizations, setOrganizations] = React.useState<OrganizationOption[]>([]);
  const [switching, setSwitching] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    async function fetchUserOrgs() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          // Store active organization
          setOrganizations([
            {
              id: data.user.activeOrganizationId || "default",
              name: organizationName,
              currency,
              roleName: data.user.roleName || "Member",
            },
          ]);
        }
      } catch {
        // Fallback
      }
    }

    if (isOpen) {
      fetchUserOrgs();
    }
  }, [isOpen, organizationName, currency]);

  const handleSwitch = async (targetOrgId: string) => {
    if (switching) return;
    setSwitching(true);

    try {
      const res = await fetch("/api/auth/switch-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: targetOrgId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsOpen(false);
        router.refresh();
      }
    } catch {
      // Handle switch error
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-white/10 glass-surface px-3 py-1.5 text-left text-xs transition-colors hover:border-indigo-500/20 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        aria-expanded={isOpen}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-500/20 text-indigo-400">
          <Building2 className="h-3.5 w-3.5" />
        </div>
        <div className="hidden flex-col sm:flex">
          <span className="font-semibold text-slate-200 line-clamp-1 max-w-[130px]">
            {organizationName}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">{currency}</span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 z-50 mt-2 w-72 rounded-xl glass-panel p-2 shadow-glass-lg space-y-2">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-400/50">
              Active Business Organization
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between rounded-lg bg-indigo-500/10 px-2.5 py-2 text-xs font-medium text-indigo-200 border border-indigo-500/20">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-semibold truncate">{organizationName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Active Tenant &bull; {currency}
                    </div>
                  </div>
                </div>
                {switching ? (
                  <RefreshCw className="h-4 w-4 text-indigo-400 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                )}
              </div>
            </div>

            <div className="border-t border-white/5 pt-1.5">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/onboarding");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
              >
                <Plus className="h-4 w-4 text-slate-500" />
                Set Up New Business Organization
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
