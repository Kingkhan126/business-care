"use client";

import React, { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet, RefreshCw, CheckCircle, RotateCcw } from 'lucide-react';

interface JournalLine {
  id?: string;
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  status: string;
  sourceType: string;
  sourceId: string | null;
  memo: string | null;
  lines: Array<{
    id: string;
    debit: number;
    credit: number;
    account: { code: string; name: string };
  }>;
}

export default function JournalEntriesPage() {
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJournals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accounting/journals');
      const data = await res.json();
      if (data.success) {
        setJournals(data.data);
      } else {
        setError(data.error || 'Failed to fetch journal entries');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading journals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  const handlePost = async (id: string) => {
    if (!confirm('Are you sure you want to post this journal entry to the General Ledger?')) return;
    try {
      const res = await fetch(`/api/accounting/journals/${id}/post`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchJournals();
      } else {
        alert(data.error || 'Posting failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error posting journal entry');
    }
  };

  const handleReverse = async (id: string) => {
    const reason = prompt('Enter reason for reversal:');
    if (!reason) return;
    try {
      const res = await fetch(`/api/accounting/journals/${id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        fetchJournals();
      } else {
        alert(data.error || 'Reversal failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error reversing journal entry');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Journal Entries</h1>
          <p className="text-sm text-slate-500">
            Double-entry accounting journal records, draft postings, and reversals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchJournals}
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
        <div className="p-12 text-center text-xs text-slate-500">Loading journal entries...</div>
      ) : journals.length === 0 ? (
        <div className="p-12 border border-dashed border-slate-300 rounded-lg text-center bg-white">
          <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">No journal entries recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {journals.map((journal) => {
            const totalDebit = journal.lines.reduce((acc, l) => acc + Number(l.debit || 0), 0);
            const totalCredit = journal.lines.reduce((acc, l) => acc + Number(l.credit || 0), 0);
            return (
              <div key={journal.id} className="border border-slate-200 bg-white rounded-lg p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-slate-900">{journal.entryNumber}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(journal.entryDate).toLocaleDateString()}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      journal.status === 'POSTED' ? 'bg-emerald-100 text-emerald-800' :
                      journal.status === 'REVERSED' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {journal.status}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                      {journal.sourceType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {journal.status === 'DRAFT' && (
                      <button
                        onClick={() => handlePost(journal.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Post
                      </button>
                    )}
                    {journal.status === 'POSTED' && (
                      <button
                        onClick={() => handleReverse(journal.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reverse
                      </button>
                    )}
                  </div>
                </div>

                {journal.memo && (
                  <p className="text-xs text-slate-600 italic mb-3">Memo: {journal.memo}</p>
                )}

                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-100 text-left">
                      <th className="pb-1 font-semibold">Account</th>
                      <th className="pb-1 font-semibold text-right">Debit ($)</th>
                      <th className="pb-1 font-semibold text-right">Credit ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {journal.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="py-1 font-mono text-slate-800">
                          {l.account.code} - {l.account.name}
                        </td>
                        <td className="py-1 text-right font-mono">
                          {Number(l.debit) > 0 ? Number(l.debit).toFixed(2) : '-'}
                        </td>
                        <td className="py-1 text-right font-mono">
                          {Number(l.credit) > 0 ? Number(l.credit).toFixed(2) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t border-slate-200">
                      <td className="pt-2 text-slate-700">Total</td>
                      <td className="pt-2 text-right font-mono text-slate-900">${totalDebit.toFixed(2)}</td>
                      <td className="pt-2 text-right font-mono text-slate-900">${totalCredit.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
