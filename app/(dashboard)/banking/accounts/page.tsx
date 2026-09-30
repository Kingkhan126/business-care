"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Landmark,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  Wallet,
  CreditCard,
  Building,
  CheckCircle,
  XCircle,
  ArrowRight,
  Filter,
} from "lucide-react";

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    accountName: "",
    accountType: "CHECKING",
    institutionName: "",
    accountNumberMasked: "",
    routingNumber: "",
    currency: "USD",
    openingBalance: 0,
    openingBalanceDate: new Date().toISOString().split("T")[0],
    linkedLedgerAccountId: "",
    description: "",
    createOpeningBalanceJournal: false,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (typeFilter) params.set("accountType", typeFilter);

      const [accRes, glRes] = await Promise.all([
        fetch(`/api/banking/accounts?${params.toString()}`),
        fetch("/api/accounting/accounts?accountType=ASSET"),
      ]);

      const accJson = await accRes.json();
      const glJson = await glRes.json();

      if (accJson.success) setAccounts(accJson.data.items || []);
      if (glJson.success) setLedgerAccounts(glJson.data.items || []);
    } catch (e) {
      console.error("Failed to load accounts", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        openingBalance: Number(formData.openingBalance),
        linkedLedgerAccountId: formData.linkedLedgerAccountId || null,
        institutionName: formData.institutionName || null,
        accountNumberMasked: formData.accountNumberMasked || null,
        routingNumber: formData.routingNumber || null,
        description: formData.description || null,
      };

      const res = await fetch("/api/banking/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create account");
      }

      setShowAddModal(false);
      setFormData({
        accountName: "",
        accountType: "CHECKING",
        institutionName: "",
        accountNumberMasked: "",
        routingNumber: "",
        currency: "USD",
        openingBalance: 0,
        openingBalanceDate: new Date().toISOString().split("T")[0],
        linkedLedgerAccountId: "",
        description: "",
        createOpeningBalanceJournal: false,
      });
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "CASH":
        return <Wallet className="h-4 w-4 text-amber-500" />;
      case "CREDIT_CARD":
        return <CreditCard className="h-4 w-4 text-purple-500" />;
      default:
        return <Landmark className="h-4 w-4 text-blue-500" />;
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
            <span className="text-slate-900 font-medium">Accounts</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Bank & Cash Accounts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure financial accounts, monitor operational vs general ledger balances, and view transaction registers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Add Account
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, bank, or mask..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Account Types</option>
            <option value="CHECKING">Checking</option>
            <option value="SAVINGS">Savings</option>
            <option value="CASH">Cash on Hand</option>
            <option value="CREDIT_CARD">Credit Card</option>
            <option value="MONEY_MARKET">Money Market</option>
            <option value="OTHER">Other</option>
          </select>
          <button
            onClick={fetchData}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Account Name</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Institution / Mask</th>
              <th className="py-3 px-4">Currency</th>
              <th className="py-3 px-4">Linked GL Account</th>
              <th className="py-3 px-4 text-right">Operational Balance</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  Loading bank accounts...
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  No accounts found. Click &quot;Add Account&quot; to configure your first bank or cash register.
                </td>
              </tr>
            ) : (
              accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/75 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <Link href={`/banking/accounts/${acc.id}`} className="hover:text-indigo-600 flex items-center gap-2">
                      {getTypeIcon(acc.accountType)}
                      {acc.accountName}
                    </Link>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                      {acc.accountType}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">
                    {acc.institutionName || "—"}{" "}
                    {acc.accountNumberMasked && (
                      <span className="font-mono text-xs text-slate-400">({acc.accountNumberMasked})</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs">{acc.currency}</td>
                  <td className="py-3.5 px-4">
                    {acc.linkedLedgerAccount ? (
                      <span className="text-xs text-indigo-600 font-medium">
                        {acc.linkedLedgerAccount.accountCode} - {acc.linkedLedgerAccount.accountName}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Not Linked</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    ${Number(acc.currentBalance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {acc.isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        <XCircle className="h-3 w-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/banking/accounts/${acc.id}`}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Register &rarr;
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Landmark className="h-5 w-5 text-indigo-600" />
                Add Bank or Cash Account
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operating Checking, Petty Cash Vault"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Account Type *
                  </label>
                  <select
                    value={formData.accountType}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                  >
                    <option value="CHECKING">Checking</option>
                    <option value="SAVINGS">Savings</option>
                    <option value="CASH">Cash on Hand</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="MONEY_MARKET">Money Market</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Currency *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Financial Institution
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chase, Wells Fargo"
                    value={formData.institutionName}
                    onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Masked Account #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ****4589"
                    value={formData.accountNumberMasked}
                    onChange={(e) => setFormData({ ...formData, accountNumberMasked: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Link to General Ledger Account
                </label>
                <select
                  value={formData.linkedLedgerAccountId}
                  onChange={(e) => setFormData({ ...formData, linkedLedgerAccountId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                >
                  <option value="">-- Select GL Asset Account --</option>
                  {ledgerAccounts.map((gl) => (
                    <option key={gl.id} value={gl.id}>
                      {gl.accountCode} - {gl.accountName}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enables double-entry postings for transfers, fees, interest, and opening balances.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Opening Balance ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Opening Date
                  </label>
                  <input
                    type="date"
                    value={formData.openingBalanceDate}
                    onChange={(e) => setFormData({ ...formData, openingBalanceDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {formData.openingBalance !== 0 && formData.linkedLedgerAccountId && (
                <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <input
                    type="checkbox"
                    id="createJournal"
                    checked={formData.createOpeningBalanceJournal}
                    onChange={(e) => setFormData({ ...formData, createOpeningBalanceJournal: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="createJournal" className="text-xs text-indigo-900 font-medium">
                    Automatically create opening balance journal entry (Dr Bank / Cr Equity)
                  </label>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
