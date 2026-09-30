"use client";

import React, { useState, useEffect } from 'react';
import { TrendingUp, RefreshCw, Filter } from 'lucide-react';

interface LedgerEntry {
  id: string;
  entryDate: string;
  entryNumber: string;
  memo: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
}

export default function GeneralLedgerPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/accounting/accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.length > 0) {
          setAccounts(data.data);
          setSelectedAccountId(data.data[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedAccountId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);
    fetch(`/api/accounting/reports/ledger?accountId=${selectedAccountId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success) {
          setReport(data.data);
        } else {
          setError(data.error || 'Failed to load General Ledger');
        }
      })
      .catch((err: any) => {
        if (isMounted) setError(err.message || 'Error loading General Ledger');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedAccountId, refreshKey]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">General Ledger</h1>
          <p className="text-sm text-slate-500">
            Account-level ledger history with running balance tracking and entry line items.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 border border-slate-200 rounded-lg">
        <div className="flex-1 w-full">
          <label className="block text-xs font-semibold text-slate-700 mb-1">Select Account</label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full text-xs p-2 border border-slate-300 rounded-md bg-white text-slate-900 font-mono"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} - {acc.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="self-end px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Update Ledger
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Generating General Ledger...</div>
      ) : report ? (
        <div className="border border-slate-200 bg-white rounded-lg overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div>
              <span className="font-mono font-bold text-sm text-indigo-700">{report.account.code}</span>
              <span className="ml-2 font-semibold text-sm text-slate-900">{report.account.name}</span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Opening Balance: <span className="font-bold text-slate-800">${Number(report.openingBalance).toFixed(2)}</span> |
              Ending Balance: <span className="font-bold text-indigo-700">${Number(report.endingBalance).toFixed(2)}</span>
            </div>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-left border-b border-slate-200">
                <th className="p-3 font-semibold">Date</th>
                <th className="p-3 font-semibold">Entry #</th>
                <th className="p-3 font-semibold">Memo</th>
                <th className="p-3 font-semibold text-right">Debit ($)</th>
                <th className="p-3 font-semibold text-right">Credit ($)</th>
                <th className="p-3 font-semibold text-right">Running Balance ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                    No posted ledger entries recorded for this account.
                  </td>
                </tr>
              ) : (
                report.entries.map((entry: LedgerEntry) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-600">
                      {new Date(entry.entryDate).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800">{entry.entryNumber}</td>
                    <td className="p-3 text-slate-600">{entry.memo || '-'}</td>
                    <td className="p-3 text-right font-mono">
                      {Number(entry.debit) > 0 ? Number(entry.debit).toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {Number(entry.credit) > 0 ? Number(entry.credit).toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-indigo-700">
                      ${Number(entry.runningBalance).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
