"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  ShieldCheck,
  UserCheck,
  FileText,
  Receipt,
  CreditCard,
  Truck,
  ShoppingBag,
  Package,
  Boxes,
  PieChart,
  Landmark,
  BookOpen,
  BarChart3,
  TrendingUp,
  X,
  Lock,
} from "lucide-react";

export interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  isFuture?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Core Platform",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Organization", href: "/organization", icon: Building2 },
      { name: "Team & Users", href: "/users", icon: Users },
      { name: "Settings", href: "/settings", icon: Settings },
      { name: "Audit Logs", href: "/audit", icon: ShieldCheck },
    ],
  },
  {
    title: "Sales & Customers",
    items: [
      { name: "Customers", href: "/customers", icon: UserCheck },
      { name: "Estimates", href: "/estimates", icon: FileText },
      { name: "Sales Orders", href: "/sales-orders", icon: ShoppingBag },
      { name: "Invoices", href: "/invoices", icon: Receipt },
      { name: "Customer Payments", href: "/payments", icon: CreditCard },
    ],
  },
  {
    title: "Purchases & Vendors",
    items: [
      { name: "Vendors & Suppliers", href: "/vendors", icon: Truck },
      { name: "Purchase Orders", href: "/purchase-orders", icon: FileText },
      { name: "Vendor Bills", href: "/vendor-bills", icon: Receipt },
      { name: "Vendor Payments", href: "/vendor-payments", icon: CreditCard },
    ],
  },
  {
    title: "Products & Inventory",
    items: [
      { name: "Products & Services", href: "/products", icon: Package },
      { name: "Inventory & Stock", href: "/inventory", icon: Boxes },
    ],
  },
  {
    title: "Financials & Banking",
    items: [
      { name: "Expenses", href: "/expenses", icon: Receipt },
      { name: "Expense Categories", href: "/expenses/categories", icon: PieChart },
      { name: "Banking", href: "/banking", icon: Landmark },
      { name: "Accounting", href: "/accounting", icon: BookOpen },
    ],
  },
  {
    title: "Reports & Insights",
    items: [
      { name: "Reports", href: "/reports", icon: BarChart3, isFuture: true },
      { name: "Forecasting", href: "/forecasting", icon: TrendingUp, isFuture: true },
    ],
  },
];

export function Sidebar({ isOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container — floating 3D glass panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col glass-panel border-r border-indigo-500/15 shadow-[4px_0_30px_rgba(0,0,0,0.5)] text-slate-300 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b border-indigo-500/15 px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0 group">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 shadow-glow-indigo border border-white/20 group-hover:scale-105 transition-transform duration-200">
              <img
                src="/logo.jpg"
                alt="AD CARE & MEDS PHARMACY"
                className="h-full w-full object-contain rounded-lg"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold tracking-tight text-white leading-tight text-depth truncate group-hover:text-indigo-200 transition-colors">
                AD CARE &amp; MEDS PHARMACY
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-mono font-medium">
                  Phase 7 Certified
                </span>
              </div>
            </div>
          </Link>
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="flex items-center gap-1.5 px-3">
                <span className="h-1 w-1 rounded-full bg-indigo-400/60" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-indigo-400/60">
                  {group.title}
                </h3>
              </div>
              <ul className="mt-1 space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href === "/accounting" && pathname.startsWith("/accounting")) ||
                    (item.href === "/expenses" && pathname === "/expenses") ||
                    (item.href === "/expenses/categories" && pathname.startsWith("/expenses/categories"));
                  const Icon = item.icon;

                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={onCloseMobile}
                        className={cn(
                          "relative group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150",
                          isActive
                            ? "bg-gradient-to-r from-indigo-600/90 to-indigo-700/80 text-white font-semibold bevel-active before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-indigo-400 before:rounded-r-full"
                            : "text-slate-400 hover:bg-white/[0.04] hover:translate-x-0.5 hover:text-slate-200"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={cn(
                              "h-4 w-4 flex-shrink-0 transition-all duration-150",
                              isActive
                                ? "text-white drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                                : "text-slate-500 group-hover:text-slate-300"
                            )}
                          />
                          <span className={cn(isActive ? "text-depth font-semibold" : "text-depth-subtle")}>
                            {item.name}
                          </span>
                        </div>
                        {item.isFuture && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-1.5 py-0.5 text-[9px] font-mono text-slate-500">
                            <Lock className="h-2.5 w-2.5" />
                            Next
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
