"use client";

import * as React from "react";
import { SessionUser } from "@/types/auth";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export interface AppShellProps {
  user: SessionUser;
  organizationName?: string;
  currency?: string;
  children: React.ReactNode;
}

export function AppShell({
  user,
  organizationName,
  currency,
  children,
}: AppShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-transparent text-slate-200 font-sans">
      <Sidebar
        isOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          user={user}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          organizationName={organizationName}
          currency={currency}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
