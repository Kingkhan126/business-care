"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

export function Tabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [activeTab, setActiveTab] = React.useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn("w-full space-y-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex space-x-1 border-b border-white/10", className)}>
      {children}
    </div>
  );
}

export function TabTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabTrigger must be used within Tabs");

  const isActive = ctx.activeTab === value;

  return (
    <button
      onClick={() => ctx.setActiveTab(value)}
      className={cn(
        "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px focus:outline-none",
        isActive
          ? "border-indigo-400 text-indigo-300 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]"
          : "border-transparent text-slate-400 hover:text-slate-200 hover:border-white/20",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabContent must be used within Tabs");

  if (ctx.activeTab !== value) return null;

  return <div className={cn("mt-4", className)}>{children}</div>;
}
