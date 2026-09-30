"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Landmark,
  ArrowLeft,
  RefreshCw,
  Plus,
  ArrowLeftRight,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Search,
  CheckCircle,
  Clock,
  Ban,
  Filter,
} from "lucide-react";

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showTxModal, setShowTxModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [txForm, setTxForm] = useState({
    transactionDate: new Date().toISOString().split("T")[0],
    transactionType: "DEPOSIT",
    amount: "",
    description: "",
    reference: "",
    payee: "",
    category: "",
    memo: "",
  });

  const fetchRegister = async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (statusFilter) q.set("status", statusFilter);
      if (typeFilter) q.set("transactionType", typeFilter);

      const res = await fetch(`/api/banking/accounts/${accountId}/register?${q.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (e) {
      console.error("Failed to load register", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accountId) fetchRegister();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, statusFilter, typeFilter]);

  const handleCreateDirectTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      const payload = {
        bankAccountId: accountId,
        transactionDate: txForm.transactionDate,
        transactionType: txForm.transactionType,
        amount: parseFloat(txForm.amount) || 0,
        description: txForm.description,
        reference: txForm.reference || null,
        payee: txForm.payee || null,
        category: txForm.category || null,
        memo: txForm.memo || null,
      };

      const res = await fetch("/api/banking/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record transaction");

      setShowTxModal(false);
      setTxForm({
        transactionDate: new Date().toISOString().split("T")[0],
        transactionType: "DEPOSIT",
        amount: "",
        description: "",
        reference: "",
        payee: "",
        category: "",
        memo: "",
      });
      fetchRegister();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const account = data?.account;
  const transactions = data?.transactions || [];

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/banking" className="hover:text-indigo-600">Banking</Link>
        <span>/</span>
        <Link href="/banking/accounts" className="hover:text-indigo-600">Accounts</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{account?.accountName || "Account Detail"}</span>
      </div>

      {/* Account Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900">{account?.accountName || "Loading..."}</h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {account?.accountType}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {account?.institutionName || "Financial Institution"}{" "}
                {account?.accountNumberMasked && `(${account.accountNumberMasked})`} &bull; Currency:{" "}
                <span className="font-mono font-medium">{account?.currency}</span>
              </p>
              {account?.linkedLedgerAccount && (
                <p className="text-xs text-indigo-600 font-medium mt-1">
                  GL Single Source of Truth: {account.linkedLedgerAccount.accountCode} - {account.linkedLedgerAccount.accountName}
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowTxModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Transaction
            </button>
            <Link
              href="/banking/transfers"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Transfer
            </Link>
            <Link
              href="/banking/import"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Import CSV
            </Link>
            <Link
              href="/banking/reconciliation"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 shadow-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Reconcile
            </Link>
          </div>
        </div>

        {/* Dual Balances & Variance Alert */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/60">
            <span className="text-xs text-slate-500 font-medium">Operational Statement Balance</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {account?.currency || "PKR"} {Number(account?.currentBalance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Current calculated bank balance</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/60">
            <span className="text-xs text-slate-500 font-medium">General Ledger Book Balance</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {account?.currency || "PKR"} {Number(account?.ledgerBalance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Authoritative double-entry GL balance</p>
          </div>

          <div className={`p-4 rounded-lg border ${Math.abs(account?.variance || 0) > 0.01 ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-emerald-50 border-emerald-200 text-emerald-900"}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider">Variance to Reconcile</span>
              {Math.abs(account?.variance || 0) > 0.01 ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              )}
            </div>
            <div className="text-2xl font-bold mt-1">
              {account?.currency || "PKR"} {Number(account?.variance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] mt-1 opacity-80">
              {Math.abs(account?.variance || 0) > 0.01 ? "Statement variance requires matching/reconciliation" : "Operational and GL balances strictly match"}
            </p>
          </div>
        </div>
      </div>

      {/* Register Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search description, payee, or ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchRegister()}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="UNMATCHED">Unmatched</option>
            <option value="MATCHED">Matched</option>
            <option value="RECONCILED">Reconciled</option>
            <option value="VOIDED">Voided</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Types</option>
            <option value="DEPOSIT">Deposit</option>
            <option value="WITHDRAWAL">Withdrawal</option>
            <option value="TRANSFER_IN">Transfer In</option>
            <option value="TRANSFER_OUT">Transfer Out</option>
            <option value="FEE">Fee</option>
            <option value="INTEREST">Interest</option>
          </select>
          <button
            onClick={fetchRegister}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Transaction Register Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Description / Payee</th>
              <th className="py-3 px-4">Reference</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Inflow</th>
              <th className="py-3 px-4 text-right">Outflow</th>
              <th className="py-3 px-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  Loading transactions...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  No transactions recorded yet for this account.
                </td>
              </tr>
            ) : (
              transactions.map((tx: any) => {
                const amt = Number(tx.amount);
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600 font-mono">
                      {new Date(tx.transactionDate).toISOString().split("T")[0]}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{tx.description}</div>
                      {tx.payee && <div className="text-xs text-slate-400">Payee: {tx.payee}</div>}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">
                      {tx.reference || "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {tx.status === "RECONCILED" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle className="h-3 w-3" /> Reconciled
                        </span>
                      )}
                      {tx.status === "MATCHED" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Matched
                        </span>
                      )}
                      {tx.status === "UNMATCHED" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Clock className="h-3 w-3" /> Unmatched
                        </span>
                      )}
                      {tx.status === "VOIDED" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                          <Ban className="h-3 w-3" /> Voided
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 font-medium">
                      {amt > 0 ? `$${amt.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 font-medium">
                      {amt < 0 ? `$${Math.abs(amt).toFixed(2)}` : "—"}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${amt >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {amt >= 0 ? `+$${amt.toFixed(2)}` : `-$${Math.abs(amt).toFixed(2)}`}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Direct Transaction Modal */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-600" />
                Record Direct Transaction
              </h2>
              <button
                onClick={() => setShowTxModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateDirectTx} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Type *
                  </label>
                  <select
                    value={txForm.transactionType}
                    onChange={(e) => setTxForm({ ...txForm, transactionType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                  >
                    <option value="DEPOSIT">Deposit</option>
                    <option value="WITHDRAWAL">Withdrawal</option>
                    <option value="FEE">Bank Fee</option>
                    <option value="INTEREST">Interest Earned</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={txForm.transactionDate}
                    onChange={(e) => setTxForm({ ...txForm, transactionDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={txForm.amount}
                  onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly maintenance fee, Client cash deposit"
                  value={txForm.description}
                  onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Reference / Cheque #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CHQ-9912"
                    value={txForm.reference}
                    onChange={(e) => setTxForm({ ...txForm, reference: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Payee / Source
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Utility Company"
                    value={txForm.payee}
                    onChange={(e) => setTxForm({ ...txForm, payee: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Record Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
