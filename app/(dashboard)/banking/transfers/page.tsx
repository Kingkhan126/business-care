"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Plus,
  RefreshCw,
  Search,
  CheckCircle,
  Landmark,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    fromBankAccountId: "",
    toBankAccountId: "",
    amount: "",
    feeAmount: "0",
    transferDate: new Date().toISOString().split("T")[0],
    reference: "",
    memo: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      if (search) q.set("search", search);

      const [trfRes, accRes] = await Promise.all([
        fetch(`/api/banking/transfers?${q.toString()}`),
        fetch("/api/banking/accounts"),
      ]);

      const trfJson = await trfRes.json();
      const accJson = await accRes.json();

      if (trfJson.success) setTransfers(trfJson.data.items || []);
      if (accJson.success) setAccounts(accJson.data.items || []);
    } catch (e) {
      console.error("Failed to load transfers", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      const payload = {
        fromBankAccountId: form.fromBankAccountId,
        toBankAccountId: form.toBankAccountId,
        amount: parseFloat(form.amount) || 0,
        feeAmount: parseFloat(form.feeAmount) || 0,
        transferDate: form.transferDate,
        reference: form.reference || null,
        memo: form.memo || null,
      };

      const res = await fetch("/api/banking/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to execute transfer");

      setShowModal(false);
      setForm({
        fromBankAccountId: "",
        toBankAccountId: "",
        amount: "",
        feeAmount: "0",
        transferDate: new Date().toISOString().split("T")[0],
        reference: "",
        memo: "",
      });
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/banking" className="hover:text-indigo-600">Banking</Link>
            <span>/</span>
            <span className="text-slate-900 font-medium">Transfers</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Inter-Account Bank & Cash Transfers
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Move funds atomically between bank accounts and cash registers with automated balanced double-entry GL postings.
          </p>
        </div>
        <div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            New Transfer
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search transfer # or memo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={fetchData}
          className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Transfers Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Transfer #</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Source Account</th>
              <th className="py-3 px-4">Destination Account</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-right">Fee</th>
              <th className="py-3 px-4">GL Journal</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  Loading transfers...
                </td>
              </tr>
            ) : transfers.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  No bank transfers recorded yet.
                </td>
              </tr>
            ) : (
              transfers.map((trf) => (
                <tr key={trf.id} className="hover:bg-slate-50/75 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900">
                    {trf.transferNumber}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {new Date(trf.transferDate).toISOString().split("T")[0]}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    {trf.fromBankAccount?.accountName}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    {trf.toBankAccount?.accountName}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    ${Number(trf.amount).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                    {Number(trf.feeAmount) > 0 ? `$${Number(trf.feeAmount).toFixed(2)}` : "—"}
                  </td>
                  <td className="py-3.5 px-4">
                    {trf.journalEntry ? (
                      <span className="font-mono text-xs text-indigo-600 font-medium">
                        {trf.journalEntry.journalNumber}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">None</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle className="h-3 w-3" /> Completed
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Transfer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-indigo-600" />
                Record Inter-Account Transfer
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Source Account (From) *
                </label>
                <select
                  required
                  value={form.fromBankAccountId}
                  onChange={(e) => setForm({ ...form, fromBankAccountId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                >
                  <option value="">-- Select Source Account --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.id === form.toBankAccountId}>
                      {a.accountName} (${Number(a.currentBalance).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Destination Account (To) *
                </label>
                <select
                  required
                  value={form.toBankAccountId}
                  onChange={(e) => setForm({ ...form, toBankAccountId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                >
                  <option value="">-- Select Destination Account --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.id === form.fromBankAccountId}>
                      {a.accountName} (${Number(a.currentBalance).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Transfer Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Bank Fee ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.feeAmount}
                    onChange={(e) => setForm({ ...form, feeAmount: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Transfer Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.transferDate}
                    onChange={(e) => setForm({ ...form, transferDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Reference
                  </label>
                  <input
                    type="text"
                    placeholder="Wire / Cheque #"
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Memo / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Replenish petty cash vault"
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Live Preview Info Box */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-600">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  Atomic Transaction Execution Guarantee:
                </div>
                <p>
                  &bull; From Account will decrease by ${(Number(form.amount || 0) + Number(form.feeAmount || 0)).toFixed(2)}
                </p>
                <p>
                  &bull; To Account will increase by ${Number(form.amount || 0).toFixed(2)}
                </p>
                <p>
                  &bull; Auto-posts balanced double-entry journal if accounts are linked to General Ledger.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Executing..." : "Confirm & Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
