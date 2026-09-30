"use client";

import React, { useState, useEffect } from 'react';
import { Scale, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface StatementLine {
  code: string;
  name: string;
  amount: number;
}

export default function BalanceSheetPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalanceSheet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accounting/reports/balance-sheet');
      const data = await res.json();
      if (data.success) {
        setReport(data.data);
      } else {
        setError(data.error || 'Failed to generate Balance Sheet');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading Balance Sheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalanceSheet();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Balance Sheet</h1>
          <p className="text-sm text-slate-500">
            Statement of Financial Position: Assets = Liabilities + Owner Equity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchBalanceSheet}
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
        <div className="p-12 text-center text-xs text-slate-500">Generating Balance Sheet...</div>
      ) : report ? (
        <div className="space-y-4 text-xs">
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
                  {report.isBalanced ? 'Accounting Equation Balanced' : 'Accounting Discrepancy Found'}
                </h3>
                <p className="text-xs opacity-90">
                  {report.isBalanced
                    ? 'Assets strictly equal Liabilities + Equity. Financial position is verified.'
                    : 'Assets do not equal Liabilities + Equity.'}
                </p>
              </div>
            </div>
            <div className="text-right font-mono">
              <div>Assets: <span className="font-bold">${Number(report.totalAssets).toFixed(2)}</span></div>
              <div>Liabilities + Equity: <span className="font-bold">${Number(report.totalLiabilitiesAndEquity).toFixed(2)}</span></div>
            </div>
          </div>

          <div className="border border-slate-200 bg-white rounded-lg p-6 shadow-xs space-y-6">
            {/* ASSETS */}
            <div>
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-200 pb-2 mb-3">
                Assets
              </h3>
              <div className="space-y-1 pl-2">
                {report.assets.lines.map((l: StatementLine) => (
                  <div key={l.code} className="flex justify-between py-1 text-slate-700">
                    <span>{l.code} - {l.name}</span>
                    <span className="font-mono">${Number(l.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 mt-2">
                <span>TOTAL ASSETS</span>
                <span className="font-mono text-indigo-700">${Number(report.assets.total).toFixed(2)}</span>
              </div>
            </div>

            {/* LIABILITIES */}
            <div>
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-200 pb-2 mb-3">
                Liabilities
              </h3>
              <div className="space-y-1 pl-2">
                {report.liabilities.lines.map((l: StatementLine) => (
                  <div key={l.code} className="flex justify-between py-1 text-slate-700">
                    <span>{l.code} - {l.name}</span>
                    <span className="font-mono">${Number(l.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 mt-2">
                <span>TOTAL LIABILITIES</span>
                <span className="font-mono text-slate-800">${Number(report.liabilities.total).toFixed(2)}</span>
              </div>
            </div>

            {/* EQUITY */}
            <div>
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-200 pb-2 mb-3">
                Equity
              </h3>
              <div className="space-y-1 pl-2">
                {report.equity.lines.map((l: StatementLine) => (
                  <div key={l.code} className="flex justify-between py-1 text-slate-700">
                    <span>{l.code} - {l.name}</span>
                    <span className="font-mono">${Number(l.amount).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-1 text-slate-700 italic">
                  <span>Current Period Retained Earnings (Net Profit)</span>
                  <span className="font-mono">${Number(report.equity.currentPeriodNetIncome).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 mt-2">
                <span>TOTAL EQUITY</span>
                <span className="font-mono text-slate-800">${Number(report.equity.total).toFixed(2)}</span>
              </div>
            </div>

            {/* TOTAL LIABILITIES & EQUITY */}
            <div className="bg-slate-900 text-white p-4 rounded-lg flex justify-between items-center text-sm font-bold">
              <span>TOTAL LIABILITIES & EQUITY</span>
              <span className="font-mono text-lg text-emerald-400">${Number(report.totalLiabilitiesAndEquity).toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
