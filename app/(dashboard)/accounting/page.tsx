import React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  FileSpreadsheet,
  BarChart3,
  Scale,
  Calendar,
  Settings,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';

export const metadata = {
  title: 'Accounting Engine & Financials - AD CARE & MEDS PHARMACY',
};

export default function AccountingDashboardPage() {
  const modules = [
    {
      title: 'Chart of Accounts',
      description: 'Manage asset, liability, equity, revenue, and expense accounts, hierarchies, and opening balances.',
      href: '/accounting/accounts',
      icon: BookOpen,
      color: 'bg-blue-500',
    },
    {
      title: 'Journal Entries',
      description: 'Create manual journals, review automated document postings, and inspect double-entry balances.',
      href: '/accounting/journals',
      icon: FileSpreadsheet,
      color: 'bg-indigo-500',
    },
    {
      title: 'General Ledger',
      description: 'Inspect full transaction history per account with running balances and date range filtering.',
      href: '/accounting/ledger',
      icon: TrendingUp,
      color: 'bg-emerald-500',
    },
    {
      title: 'Trial Balance',
      description: 'Verify mathematical integrity where total debits strictly equal total credits across all accounts.',
      href: '/accounting/trial-balance',
      icon: Scale,
      color: 'bg-amber-500',
    },
    {
      title: 'Profit & Loss',
      description: 'Income statement summarizing total revenue, cost of goods sold, gross profit, operating expenses, and net income.',
      href: '/accounting/profit-loss',
      icon: BarChart3,
      color: 'bg-purple-500',
    },
    {
      title: 'Balance Sheet',
      description: 'Financial position report verifying Assets = Liabilities + Equity with current period retained earnings.',
      href: '/accounting/balance-sheet',
      icon: Scale,
      color: 'bg-teal-500',
    },
    {
      title: 'Accounting Periods',
      description: 'Manage monthly fiscal periods, lock completed periods, and enforce period immutability.',
      href: '/accounting/periods',
      icon: Calendar,
      color: 'bg-rose-500',
    },
    {
      title: 'Account Mappings',
      description: 'Configure default system GL accounts for invoices, payments, COGS, inventory, sales, and accounts payable.',
      href: '/accounting/settings',
      icon: Settings,
      color: 'bg-slate-600',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">General Ledger & Accounting</h1>
          <p className="text-sm text-slate-500">
            Enterprise double-entry accounting engine, financial statements, and posting controls.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Double-Entry Balance Protection Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group relative flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-indigo-500 hover:shadow-md"
            >
              <div>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg text-white ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {item.title}
                  </h2>
                </div>
                <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-indigo-600 group-hover:translate-x-1 transition-transform">
                <span>Access Module</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
