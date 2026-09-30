"use client";

import React, { useState, useEffect } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';

interface StatementSection {
  code: string;
  name: string;
  amount: number;
}

export default function ProfitAndLossPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPL = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accounting/reports/profit-loss');
      const data = await res.json();
      if (data.success) {
        setReport(data.data);
      } else {
        setError(data.error || 'Failed to generate P&L Statement');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading P&L Statement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPL();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Profit & Loss Statement</h1>
          <p className="text-sm text-slate-500">
            Income statement summarizing Revenues, Cost of Goods Sold, and Operating Expenses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPL}
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
        <div className="p-12 text-center text-xs text-slate-500">Generating Profit & Loss Statement...</div>
      ) : report ? (
        <div className="border border-slate-200 bg-white rounded-lg p-6 shadow-xs space-y-6 text-xs">
          {/* Revenue */}
          <div>
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-200 pb-2 mb-3">
              Revenue / Income
            </h3>
            <div className="space-y-1 pl-2">
              {report.revenue.lines.map((l: StatementSection) => (
                <div key={l.code} className="flex justify-between py-1 text-slate-700">
                  <span>{l.code} - {l.name}</span>
                  <span className="font-mono">${Number(l.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 mt-2">
              <span>Total Operating Revenue</span>
              <span className="font-mono text-emerald-700">${Number(report.revenue.total).toFixed(2)}</span>
            </div>
          </div>

          {/* COGS */}
          <div>
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-200 pb-2 mb-3">
              Cost of Goods Sold (COGS)
            </h3>
            <div className="space-y-1 pl-2">
              {report.costOfGoodsSold.lines.map((l: StatementSection) => (
                <div key={l.code} className="flex justify-between py-1 text-slate-700">
                  <span>{l.code} - {l.name}</span>
                  <span className="font-mono">${Number(l.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 mt-2">
              <span>Total Cost of Goods Sold</span>
              <span className="font-mono text-rose-700">${Number(report.costOfGoodsSold.total).toFixed(2)}</span>
            </div>
          </div>

          {/* Gross Profit */}
          <div className="bg-slate-50 p-3 rounded border border-slate-200 flex justify-between font-bold text-sm text-slate-900">
            <span>GROSS PROFIT</span>
            <span className="font-mono text-indigo-700">${Number(report.grossProfit).toFixed(2)}</span>
          </div>

          {/* Operating Expenses */}
          <div>
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-200 pb-2 mb-3">
              Operating Expenses
            </h3>
            <div className="space-y-1 pl-2">
              {report.operatingExpenses.lines.map((l: StatementSection) => (
                <div key={l.code} className="flex justify-between py-1 text-slate-700">
                  <span>{l.code} - {l.name}</span>
                  <span className="font-mono">${Number(l.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 mt-2">
              <span>Total Operating Expenses</span>
              <span className="font-mono text-rose-700">${Number(report.operatingExpenses.total).toFixed(2)}</span>
            </div>
          </div>

          {/* Net Income */}
          <div className="bg-indigo-900 text-white p-4 rounded-lg flex justify-between items-center text-sm font-bold shadow-sm">
            <span>NET OPERATING INCOME / PROFIT</span>
            <span className="font-mono text-lg text-emerald-400">${Number(report.netProfit).toFixed(2)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
