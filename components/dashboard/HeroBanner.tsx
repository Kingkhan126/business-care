import Link from "next/link";
import Image from "next/image";
import React from "react";
import { FileText, Receipt, Building2 } from "lucide-react";

export interface HeroBannerProps {
  organizationName: string;
  logoUrl?: string | null;
  roleName?: string;
  permissions: string[];
}

export function HeroBanner({ organizationName, logoUrl, roleName = "Member", permissions }: HeroBannerProps) {
  const actions = [
    { permission: "invoices.create", href: "/invoices", label: "Create Invoice", Icon: FileText },
    { permission: "expense.create", href: "/expenses/new", label: "Record Expense", Icon: Receipt },
    { permission: "organization.update", href: "/settings", label: "Organization Settings", Icon: Building2 },
  ].filter(action => permissions.includes(action.permission));
  return (
    <div className="rounded-3xl glass-card-3d p-6 sm:p-8 border border-indigo-500/20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          {logoUrl && <Image src={logoUrl} alt={`${organizationName} logo`} width={72} height={72} unoptimized className="h-16 w-16 shrink-0 rounded-xl bg-white p-2 object-contain sm:h-[72px] sm:w-[72px]" />}
          <div>
            <p className="text-sm text-slate-400">Business overview · {roleName}</p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-white">{organizationName}</h1>
            <p className="mt-2 text-sm text-slate-300">Track your finances and keep daily work moving.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {actions.map(({ href, label, Icon }) => <Link key={href} href={href} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"><Icon aria-hidden="true" className="h-4 w-4" />{label}</Link>)}
        </div>
      </div>
    </div>
  );
}
