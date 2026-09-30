"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  RefreshCw,
  Plus,
  Landmark,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldCheck,
  Check,
  Ban,
} from "lucide-react";

export default function BankReconciliationPage() {
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showStartModal, setShowStartModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [startForm, setStartForm] = useState({
    bankAccountId: "",
    statementStartDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    statementEndDate: new Date().toISOString().split("T")[0],
    statementEndingBalance: "",
    notes: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [recRes, accRes] = await Promise.all([
        fetch("/api/banking/reconciliation"),
        fetch("/api/banking/accounts"),
      ]);

      const recJson = await recRes.json();
      const accJson = await accRes.json();

      if (recJson.success) {
        setReconciliations(recJson.data.items || []);
        // If an open reconciliation exists, automatically load it
        const openRec = recJson.data.items?.find((r: any) => r.status === "OPEN");
        if (openRec) {
          loadSession(openRec.id);
        } else if (recJson.data.items?.length > 0 && !activeSession) {
          loadSession(recJson.data.items[0].id);
        }
      }
      if (accJson.success) setAccounts(accJson.data.items || []);
    } catch (e) {
      console.error("Failed to load reconciliations", e);
    } finally {
      setLoading(false);
    }
  };

  const loadSession = async (id: string) => {
    try {
      const res = await fetch(`/api/banking/reconciliation/${id}`);
      const json = await res.json();
      if (json.success) {
        setActiveSession(json.data);
      }
    } catch (e) {
      console.error("Failed to load session details", e);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      const payload = {
        bankAccountId: startForm.bankAccountId,
        statementStartDate: startForm.statementStartDate,
        statementEndDate: startForm.statementEndDate,
        statementEndingBalance: parseFloat(startForm.statementEndingBalance) || 0,
        notes: startForm.notes || null,
      };

      const res = await fetch("/api/banking/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start reconciliation");

      setShowStartModal(false);
      fetchData();
      loadSession(json.data.id);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleItem = async (bankTransactionId: string, currentCleared: boolean) => {
    if (!activeSession || activeSession.status !== "OPEN") return;

    try {
      const res = await fetch(`/api/banking/reconciliation/${activeSession.id}/toggle-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankTransactionId,
          isCleared: !currentCleared,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActiveSession(json.data);
      }
    } catch (e) {
      console.error("Failed to toggle item", e);
    }
  };

  const handleCompleteReconciliation = async () => {
    if (!activeSession) return;
    if (Math.abs(Number(activeSession.difference)) > 0.001) {
      alert(`Cannot complete reconciliation. Difference must be $0.00. Current variance: $${Number(activeSession.difference).toFixed(2)}`);
      return;
    }

    if (!confirm("Are you sure you want to finalize this reconciliation? Reconciled transactions will be locked against changes.")) {
      return;
    }

    try {
      const res = await fetch(`/api/banking/reconciliation/${activeSession.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to complete reconciliation");

      alert("Reconciliation completed and verified successfully!");
      fetchData();
      loadSession(activeSession.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleVoidReconciliation = async () => {
    if (!activeSession) return;
    const reason = prompt("Enter a reason for voiding this completed reconciliation:");
    if (!reason) return;

    try {
      const res = await fetch(`/api/banking/reconciliation/${activeSession.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to void reconciliation");

      fetchData();
      loadSession(activeSession.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const diff = Number(activeSession?.difference ?? 0);
  const isZeroDiff = Math.abs(diff) <= 0.001;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/banking" className="hover:text-indigo-600">Banking</Link>
            <span>/</span>
            <span className="text-slate-900 font-medium">Reconciliation</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-teal-600" />
            Bank Statement Reconciliation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Verify operational bank statements against registered ledger transactions with zero-difference enforcement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStartModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Start Reconciliation
          </button>
        </div>
      </div>

      {/* Session Header / Reconciliations Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 uppercase">Select Session:</span>
          <select
            value={activeSession?.id || ""}
            onChange={(e) => loadSession(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            {reconciliations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.reconciliationNumber} - {r.bankAccount?.accountName} ({r.status})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {activeSession?.status === "OPEN" && (
            <button
              onClick={handleCompleteReconciliation}
              disabled={!isZeroDiff}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-colors ${
                isZeroDiff
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <Check className="h-4 w-4" />
              Complete Reconciliation
            </button>
          )}

          {activeSession?.status === "COMPLETED" && (
            <button
              onClick={handleVoidReconciliation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100"
            >
              <Ban className="h-3.5 w-3.5" />
              Void Reconciliation
            </button>
          )}
        </div>
      </div>

      {activeSession ? (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Beginning Bal</span>
              <div className="text-base font-bold text-slate-900 mt-1">
                ${Number(activeSession.statementBeginningBalance).toFixed(2)}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Cleared Inflow</span>
              <div className="text-base font-bold text-emerald-600 mt-1">
                +${Number(activeSession.clearedDepositsTotal).toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-400">({activeSession.clearedDepositsCount} items)</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Cleared Outflow</span>
              <div className="text-base font-bold text-rose-600 mt-1">
                -${Number(activeSession.clearedWithdrawalsTotal).toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-400">({activeSession.clearedWithdrawalsCount} items)</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Reconciled Bal</span>
              <div className="text-base font-bold text-slate-900 mt-1">
                ${Number(activeSession.reconciledBalance).toFixed(2)}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Statement Target</span>
              <div className="text-base font-bold text-slate-900 mt-1">
                ${Number(activeSession.statementEndingBalance).toFixed(2)}
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border ${isZeroDiff ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider">Difference</span>
                {isZeroDiff ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
              </div>
              <div className="text-base font-bold mt-1">
                ${diff.toFixed(2)}
              </div>
              <span className="text-[10px] opacity-80">{isZeroDiff ? "Balanced (Ready)" : "Requires zero diff"}</span>
            </div>
          </div>

          {/* Items Checklist Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Transactions to Reconcile ({activeSession.items?.length || 0})
                </h3>
                <p className="text-xs text-slate-500">
                  Check transactions matching your bank statement. Only balanced sessions can be completed.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
                Status: {activeSession.status}
              </span>
            </div>

            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Cleared</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Inflow</th>
                  <th className="py-3 px-4 text-right">Outflow</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeSession.items?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No unreconciled transactions found for this period.
                    </td>
                  </tr>
                ) : (
                  activeSession.items?.map((item: any) => {
                    const tx = item.bankTransaction;
                    const amt = Number(tx.amount);
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${item.isCleared ? "bg-emerald-50/40" : "hover:bg-slate-50"}`}
                      >
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            disabled={activeSession.status !== "OPEN"}
                            checked={item.isCleared}
                            onChange={() => handleToggleItem(tx.id, item.isCleared)}
                            className="h-4 w-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {new Date(tx.transactionDate).toISOString().split("T")[0]}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{tx.description}</div>
                          {tx.payee && <div className="text-xs text-slate-400">{tx.payee}</div>}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">
                          {tx.reference || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                            {tx.transactionType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600">
                          {amt > 0 ? `$${amt.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-600">
                          {amt < 0 ? `$${Math.abs(amt).toFixed(2)}` : "—"}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${amt >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          ${amt.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <CheckCircle2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">No Reconciliation Session Selected</h3>
          <p className="text-xs text-slate-400 mt-1">Start a new reconciliation session to balance bank records.</p>
        </div>
      )}

      {/* Start Reconciliation Modal */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                Start Bank Reconciliation
              </h2>
              <button
                onClick={() => setShowStartModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleStartReconciliation} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Bank Account *
                </label>
                <select
                  required
                  value={startForm.bankAccountId}
                  onChange={(e) => setStartForm({ ...startForm, bankAccountId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- Select Bank Account --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.accountName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Statement Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startForm.statementStartDate}
                    onChange={(e) => setStartForm({ ...startForm, statementStartDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Statement End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startForm.statementEndDate}
                    onChange={(e) => setStartForm({ ...startForm, statementEndDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Statement Ending Balance ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={startForm.statementEndingBalance}
                  onChange={(e) => setStartForm({ ...startForm, statementEndingBalance: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter the exact ending balance reported on your bank statement.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Notes / Memo
                </label>
                <input
                  type="text"
                  placeholder="e.g. October monthly reconciliation"
                  value={startForm.notes}
                  onChange={(e) => setStartForm({ ...startForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Starting..." : "Begin Reconciliation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
