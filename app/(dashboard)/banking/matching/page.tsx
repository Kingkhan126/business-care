"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  FileText,
  User,
  Building,
  Tag,
} from "lucide-react";

export default function MatchingHubPage() {
  const [unmatched, setUnmatched] = useState<any[]>([]);
  const [matched, setMatched] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [activeTab, setActiveTab] = useState<"unmatched" | "matched">("unmatched");

  // Direct categorize form state
  const [showCategorize, setShowCategorize] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [categorizing, setCategorizing] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoadingList(true);
      const [unmatchedRes, matchedRes, glRes] = await Promise.all([
        fetch("/api/banking/transactions?status=UNMATCHED&take=100"),
        fetch("/api/banking/transactions?status=MATCHED&take=50"),
        fetch("/api/accounting/accounts"),
      ]);

      const unJson = await unmatchedRes.json();
      const mJson = await matchedRes.json();
      const glJson = await glRes.json();

      if (unJson.success) {
        setUnmatched(unJson.data.items || []);
        if (unJson.data.items?.length > 0 && !selectedTx) {
          selectTransaction(unJson.data.items[0]);
        }
      }
      if (mJson.success) setMatched(mJson.data.items || []);
      if (glJson.success) setLedgerAccounts(glJson.data.items || []);
    } catch (e) {
      console.error("Failed to load matching transactions", e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTransaction = async (tx: any) => {
    setSelectedTx(tx);
    setShowCategorize(false);
    try {
      setLoadingCandidates(true);
      const res = await fetch(`/api/banking/matching/candidates/${tx.id}`);
      const json = await res.json();
      if (json.success) {
        setCandidates(json.data || []);
      }
    } catch (e) {
      console.error("Failed to load candidates", e);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleMatch = async (candidate: any) => {
    if (!selectedTx) return;
    try {
      const res = await fetch("/api/banking/matching/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankTransactionId: selectedTx.id,
          targetType: candidate.type,
          targetId: candidate.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to match transaction");

      fetchTransactions();
      setSelectedTx(null);
      setCandidates([]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUnmatch = async (txId: string) => {
    try {
      const res = await fetch("/api/banking/matching/unmatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankTransactionId: txId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to unmatch transaction");
      fetchTransactions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCategorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx || !targetAccountId) return;
    setCategorizing(true);

    try {
      const res = await fetch(`/api/banking/transactions/${selectedTx.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: categoryName || "Direct Expense / Deposit",
          targetLedgerAccountId: targetAccountId,
          payee: selectedTx.payee || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to categorize");

      setShowCategorize(false);
      setCategoryName("");
      setTargetAccountId("");
      fetchTransactions();
      setSelectedTx(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCategorizing(false);
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
            <span className="text-slate-900 font-medium">Matching Hub</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            Smart Transaction Matching Hub
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Match bank transactions with customer payments, vendor bills, and GL journals without creating duplicate accounting records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTransactions}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("unmatched")}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
            activeTab === "unmatched"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Clock className="h-4 w-4" />
          Unmatched Transactions ({unmatched.length})
        </button>
        <button
          onClick={() => setActiveTab("matched")}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${
            activeTab === "matched"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Matched Transactions ({matched.length})
        </button>
      </div>

      {activeTab === "unmatched" ? (
        /* Split view: Left = Unmatched Transactions, Right = Candidates / Categorize */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left panel: List */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Select Bank Transaction</span>
              <span className="text-slate-400 font-normal">Click to match</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {loadingList ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  Loading unmatched transactions...
                </div>
              ) : unmatched.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  All transactions matched! No unmatched bank items found.
                </div>
              ) : (
                unmatched.map((tx) => {
                  const isSelected = selectedTx?.id === tx.id;
                  const amt = Number(tx.amount);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => selectTransaction(tx)}
                      className={`p-3.5 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-indigo-50/80 border-l-4 border-indigo-600"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-mono text-xs text-slate-500">
                          {new Date(tx.transactionDate).toISOString().split("T")[0]}
                        </span>
                        <span className={`font-mono text-xs font-bold ${amt >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {amt >= 0 ? `+$${amt.toFixed(2)}` : `-$${Math.abs(amt).toFixed(2)}`}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">
                        {tx.description}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span>{tx.bankAccount?.accountName}</span>
                        {tx.reference && <span className="font-mono">{tx.reference}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: Candidates and Actions */}
          <div className="lg:col-span-7 space-y-4">
            {selectedTx ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
                {/* Selected Tx Detail Banner */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Selected Transaction
                  </span>
                  <div className="flex items-start justify-between mt-1">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{selectedTx.description}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedTx.bankAccount?.accountName} &bull; Date: {new Date(selectedTx.transactionDate).toISOString().split("T")[0]}
                        {selectedTx.reference && ` &bull; Ref: ${selectedTx.reference}`}
                      </p>
                    </div>
                    <div className={`text-lg font-mono font-bold ${Number(selectedTx.amount) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      ${Number(selectedTx.amount).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Candidate Matches */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      Candidate Matches ({candidates.length})
                    </h3>
                    <button
                      onClick={() => setShowCategorize(!showCategorize)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      {showCategorize ? "Cancel Categorization" : "Or Categorize Directly to GL &rarr;"}
                    </button>
                  </div>

                  {showCategorize ? (
                    <form onSubmit={handleCategorize} className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-3">
                      <div className="text-xs font-bold text-indigo-900">
                        Categorize directly to General Ledger:
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                            Category / Description
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Office Supplies, Bank Charges"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                            Target GL Account *
                          </label>
                          <select
                            required
                            value={targetAccountId}
                            onChange={(e) => setTargetAccountId(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 bg-white"
                          >
                            <option value="">-- Select GL Account --</option>
                            {ledgerAccounts.map((gl) => (
                              <option key={gl.id} value={gl.id}>
                                {gl.accountCode} - {gl.accountName} ({gl.accountType})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={categorizing}
                        className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {categorizing ? "Posting..." : "Confirm & Post GL Journal"}
                      </button>
                    </form>
                  ) : loadingCandidates ? (
                    <div className="p-8 text-center text-slate-400">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-500" />
                      Analyzing matching candidates...
                    </div>
                  ) : candidates.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
                      <p className="text-xs">No matching customer payments, vendor payments, or journal entries found.</p>
                      <button
                        onClick={() => setShowCategorize(true)}
                        className="mt-2 text-xs font-medium text-indigo-600 hover:underline"
                      >
                        Categorize directly to an expense or revenue GL account
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {candidates.map((cand) => (
                        <div
                          key={cand.id}
                          className="p-4 border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors flex items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  cand.confidence === "EXACT"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : cand.confidence === "HIGH"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {cand.confidence} MATCH
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-900">
                                {cand.referenceNumber}
                              </span>
                              <span className="text-xs text-slate-400">({cand.type.replace("_", " ")})</span>
                            </div>
                            <p className="text-xs text-slate-600">
                              {cand.partyName && <span className="font-medium">{cand.partyName} &bull; </span>}
                              {cand.description}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Date: {new Date(cand.date).toISOString().split("T")[0]} &bull; {cand.matchReason}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono text-sm font-bold text-slate-900 mb-2">
                              ${cand.amount.toFixed(2)}
                            </div>
                            <button
                              onClick={() => handleMatch(cand)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Match
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                <Sparkles className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-700">No Transaction Selected</h3>
                <p className="text-xs text-slate-400 mt-1">Select an unmatched transaction from the left panel to discover candidates.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Matched Tab: Lists matched items with unmatch option */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Matched Target</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matched.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No matched transactions yet.
                  </td>
                </tr>
              ) : (
                matched.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {new Date(tx.transactionDate).toISOString().split("T")[0]}
                    </td>
                    <td className="py-3.5 px-4 text-slate-900 font-medium">
                      {tx.bankAccount?.accountName}
                    </td>
                    <td className="py-3.5 px-4">{tx.description}</td>
                    <td className="py-3.5 px-4 text-xs font-mono text-indigo-600">
                      {tx.matchedCustomerPayment?.paymentNumber ||
                        tx.matchedVendorPayment?.paymentNumber ||
                        tx.matchedJournalEntry?.journalNumber ||
                        "Categorized GL"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ${Number(tx.amount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleUnmatch(tx.id)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                      >
                        Unmatch
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
