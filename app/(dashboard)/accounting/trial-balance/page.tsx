"use client";

import React, { useState, useEffect } from 'react';
import { Scale, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface TrialBalanceLine {
  accountId: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

export default function TrialBalancePage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrialBalance = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accounting/reports/trial-balance');
      const data = await res.json();
      if (data.success) {
        setReport(data.data);
      } else {
        setError(data.error || 'Failed to fetch Trial Balance');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading Trial Balance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrialBalance();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Trial Balance</h1>
          <p className="text-sm text-slate-500">
            Audit report confirming total debits equal total credits across all general ledger accounts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTrialBalance}
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

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Calculating Trial Balance...</div>
      ) : report ? (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border flex items-center justify-between ${
            report.isBalanced
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-3">
              {report.isBalanced ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              )}
              <div>
                <h3 className="text-sm font-bold">
                  {report.isBalanced ? 'Trial Balance is Fully Balanced' : 'Trial Balance Imbalance Detected!'}
                </h3>
                <p className="text-xs opacity-90">
                  {report.isBalanced
                    ? 'Total Debits strictly equal Total Credits. Double-entry integrity is verified.'
                    : `Discrepancy of $${Math.abs(report.totalDebits - report.totalCredits).toFixed(2)} between Debits and Credits.`}
                </p>
              </div>
            </div>
            <div className="text-right font-mono text-xs">
              <div>Debits: <span className="font-bold">${Number(report.totalDebits).toFixed(2)}</span></div>
              <div>Credits: <span className="font-bold">${Number(report.totalCredits).toFixed(2)}</span></div>
            </div>
          </div>

          <div className="border border-slate-200 bg-white rounded-lg overflow-hidden shadow-xs">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-left">
                  <th className="p-3 font-semibold">Account Code</th>
                  <th className="p-3 font-semibold">Account Name</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold text-right">Debit ($)</th>
                  <th className="p-3 font-semibold text-right">Credit ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.lines.map((line: TrialBalanceLine) => (
                  <tr key={line.accountId} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-semibold text-slate-800">{line.code}</td>
                    <td className="p-3 font-medium text-slate-900">{line.name}</td>
                    <td className="p-3 font-mono text-slate-500 uppercase">{line.type}</td>
                    <td className="p-3 text-right font-mono">
                      {Number(line.debit) > 0 ? Number(line.debit).toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {Number(line.credit) > 0 ? Number(line.credit).toFixed(2) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                  <td colSpan={3} className="p-3">TOTAL</td>
                  <td className="p-3 text-right font-mono">${Number(report.totalDebits).toFixed(2)}</td>
                  <td className="p-3 text-right font-mono">${Number(report.totalCredits).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
