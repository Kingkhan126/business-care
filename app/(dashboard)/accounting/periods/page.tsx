"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, Lock, CheckCircle, RefreshCw } from 'lucide-react';

interface AccountingPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  closedAt: string | null;
}

export default function AccountingPeriodsPage() {
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPeriods = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accounting/periods');
      const data = await res.json();
      if (data.success) {
        setPeriods(data.data);
      } else {
        setError(data.error || 'Failed to load periods');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading periods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const handleClosePeriod = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to close and lock the accounting period "${name}"? No further entries can be posted to closed periods.`)) return;
    try {
      const res = await fetch(`/api/accounting/periods/${id}/close`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchPeriods();
      } else {
        alert(data.error || 'Failed to close period');
      }
    } catch (err: any) {
      alert(err.message || 'Error closing period');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Accounting Periods</h1>
          <p className="text-sm text-slate-500">
            Fiscal month period control, status locking, and close management.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPeriods}
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
        <div className="p-12 text-center text-xs text-slate-500">Loading accounting periods...</div>
      ) : (
        <div className="border border-slate-200 bg-white rounded-lg overflow-hidden shadow-xs">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-left">
                <th className="p-3 font-semibold">Period Name</th>
                <th className="p-3 font-semibold">Start Date</th>
                <th className="p-3 font-semibold">End Date</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{p.name}</td>
                  <td className="p-3 font-mono text-slate-600">{new Date(p.startDate).toLocaleDateString()}</td>
                  <td className="p-3 font-mono text-slate-600">{new Date(p.endDate).toLocaleDateString()}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      p.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {p.status === 'OPEN' ? (
                      <button
                        onClick={() => handleClosePeriod(p.id, p.name)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium inline-flex items-center gap-1"
                      >
                        <Lock className="w-3 h-3" />
                        Close Period
                      </button>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Period Locked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
