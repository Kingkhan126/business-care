"use client";

import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Search, Shield, RefreshCw } from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  isActive: boolean;
  isSystem: boolean;
  parentId: string | null;
  currentBalance: number;
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accounting/accounts');
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data);
      } else {
        setError(data.error || 'Failed to load accounts');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.code.toLowerCase().includes(search.toLowerCase()) ||
      acc.name.toLowerCase().includes(search.toLowerCase()) ||
      acc.type.toLowerCase().includes(search.toLowerCase())
  );

  const groupByType = (type: string) => filteredAccounts.filter((acc) => acc.type === type);

  const types = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Chart of Accounts</h1>
          <p className="text-sm text-slate-500">
            Official Chart of Accounts for financial classification and double-entry postings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAccounts}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 bg-white p-3 border border-slate-200 rounded-lg">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search account code, name, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading Chart of Accounts...</div>
      ) : (
        <div className="space-y-6">
          {types.map((type) => {
            const group = groupByType(type);
            if (group.length === 0 && search) return null;
            return (
              <div key={type} className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">{type} ACCOUNTS</span>
                  <span className="text-xs font-mono text-slate-500">{group.length} Account(s)</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.length === 0 ? (
                    <div className="p-4 text-xs text-slate-400 italic">No accounts defined under {type}</div>
                  ) : (
                    group.map((acc) => (
                      <div key={acc.id} className="p-3 hover:bg-slate-50/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-slate-700 w-16">{acc.code}</span>
                          <div>
                            <span className="font-medium text-slate-900">{acc.name}</span>
                            {acc.isSystem && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                                <Shield className="w-3 h-3" /> System
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">{acc.normalBalance}</span>
                          <span className="font-mono font-semibold text-slate-900 w-28 text-right">
                            PKR {Number(acc.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
