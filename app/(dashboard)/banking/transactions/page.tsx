"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wallet,
  Search,
  RefreshCw,
  CheckCircle,
  CheckCircle2,
  Clock,
  Ban,
  ArrowRight,
  Filter,
} from "lucide-react";

export default function MasterTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (bankAccountId) q.set("bankAccountId", bankAccountId);
      if (status) q.set("status", status);
      if (type) q.set("transactionType", type);

      const [txRes, accRes] = await Promise.all([
        fetch(`/api/banking/transactions?${q.toString()}`),
        fetch("/api/banking/accounts"),
      ]);

      const txJson = await txRes.json();
      const accJson = await accRes.json();

      if (txJson.success) {
        setTransactions(txJson.data.items || []);
        setTotal(txJson.data.total || 0);
      }
      if (accJson.success) {
        setAccounts(accJson.data.items || []);
      }
    } catch (e) {
      console.error("Failed to load transactions", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankAccountId, status, type]);

  const handleVoidTransaction = async (id: string) => {
    const reason = prompt("Enter a reason for voiding this transaction:");
    if (!reason) return;

    try {
      const res = await fetch(`/api/banking/transactions/${id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to void transaction");
      fetchTransactions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/banking" className="hover:text-indigo-600">Banking</Link>
            <span>/</span>
            <span className="text-slate-900 font-medium">Transactions</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Master Transaction Register
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Search, filter, categorize, and inspect all bank and cash transactions across your entire organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/banking/matching"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs"
          >
            Open Matching Hub &rarr;
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search description, payee, ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchTransactions()}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.accountName}</option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="UNMATCHED">Unmatched</option>
            <option value="MATCHED">Matched</option>
            <option value="RECONCILED">Reconciled</option>
            <option value="VOIDED">Voided</option>
          </select>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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
            onClick={fetchTransactions}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Account</th>
              <th className="py-3 px-4">Description / Payee</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Source</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-right">Action</th>
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
                  No bank transactions found.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const amt = Number(tx.amount);
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {new Date(tx.transactionDate).toISOString().split("T")[0]}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      <Link href={`/banking/accounts/${tx.bankAccountId}`} className="hover:text-indigo-600">
                        {tx.bankAccount?.accountName || "Account"}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{tx.description}</div>
                      {tx.payee && <div className="text-xs text-slate-400">Payee: {tx.payee}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                      {tx.source}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
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
                    <td className={`py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap ${amt >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {amt >= 0 ? `+$${amt.toFixed(2)}` : `-$${Math.abs(amt).toFixed(2)}`}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {tx.status !== "RECONCILED" && tx.status !== "VOIDED" && (
                        <button
                          onClick={() => handleVoidTransaction(tx.id)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
