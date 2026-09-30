"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Receipt,
  ArrowLeft,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  CreditCard,
  Building,
  User,
  Calendar,
  DollarSign,
  FileText,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface LineItemState {
  categoryId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  notes?: string;
}

interface OptionItem {
  id: string;
  name?: string;
  displayName?: string;
  code?: string;
  accountName?: string;
}

export default function CreateExpensePage() {
  const router = useRouter();

  // Form State
  const [expenseType, setExpenseType] = useState<"DIRECT_BUSINESS" | "EMPLOYEE_CLAIM">("DIRECT_BUSINESS");
  const [paymentType, setPaymentType] = useState<"PAID_IMMEDIATELY" | "ON_ACCOUNT">("PAID_IMMEDIATELY");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [claimantId, setClaimantId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");

  // Line items state
  const [lines, setLines] = useState<LineItemState[]>([
    { categoryId: "", description: "", quantity: 1, unitPrice: 0, taxRate: 0 },
  ]);

  // Dropdown reference data
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [suppliers, setSuppliers] = useState<OptionItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<OptionItem[]>([]);
  const [claimants, setClaimants] = useState<Array<{ id: string; name: string; email: string }>>([]);

  const [loadingLookups, setLoadingLookups] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load lookup data
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingLookups(true);
        const [catRes, suppRes, bankRes, orgRes] = await Promise.all([
          fetch("/api/expenses/categories"),
          fetch("/api/suppliers?take=100"),
          fetch("/api/banking/accounts?isActive=true"),
          fetch("/api/organization"),
        ]);

        if (catRes.ok) {
          const cats = await catRes.json();
          setCategories(cats || []);
        }
        if (suppRes.ok) {
          const supps = await suppRes.json();
          setSuppliers(supps.items || []);
        }
        if (bankRes.ok) {
          const banks = await bankRes.json();
          setBankAccounts(banks.data || []);
        }
        if (orgRes.ok) {
          const org = await orgRes.json();
          if (org.organization?.members) {
            setClaimants(
              org.organization.members.map((m: any) => ({
                id: m.user.id,
                name: m.user.name,
                email: m.user.email,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load reference lookup data", err);
      } finally {
        setLoadingLookups(false);
      }
    }
    loadData();
  }, []);

  // Line items manipulation
  const handleAddLine = () => {
    setLines([...lines, { categoryId: "", description: "", quantity: 1, unitPrice: 0, taxRate: 0 }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof LineItemState, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  // Client Calculation Preview (User convenience preview only; server authoritative calculation on POST)
  const previewTotals = lines.reduce(
    (acc, line) => {
      const q = Number(line.quantity) || 0;
      const p = Number(line.unitPrice) || 0;
      const tRate = Number(line.taxRate) || 0;
      const sub = Math.round(q * p * 100) / 100;
      const tax = Math.round(((sub * tRate) / 100) * 100) / 100;
      return {
        subtotal: acc.subtotal + sub,
        taxTotal: acc.taxTotal + tax,
        total: acc.total + sub + tax,
      };
    },
    { subtotal: 0, taxTotal: 0, total: 0 }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Client-side validations
    if (!description.trim()) {
      setErrorMsg("Expense description is required.");
      return;
    }

    if (expenseType === "EMPLOYEE_CLAIM" && !claimantId) {
      setErrorMsg("Claimant employee must be selected for employee reimbursement claims.");
      return;
    }

    if (expenseType === "DIRECT_BUSINESS" && paymentType === "PAID_IMMEDIATELY" && !bankAccountId) {
      setErrorMsg("Bank account is required for immediate business disbursements.");
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.description.trim()) {
        setErrorMsg(`Line item #${i + 1} requires a description.`);
        return;
      }
      if (l.quantity <= 0) {
        setErrorMsg(`Line item #${i + 1} quantity must be greater than zero.`);
        return;
      }
      if (l.unitPrice < 0) {
        setErrorMsg(`Line item #${i + 1} unit price cannot be negative.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        expenseType,
        paymentType,
        expenseDate,
        dueDate: dueDate || null,
        description,
        notes: notes || null,
        currency,
        claimantId: expenseType === "EMPLOYEE_CLAIM" ? claimantId : null,
        supplierId: expenseType === "DIRECT_BUSINESS" && supplierId ? supplierId : null,
        bankAccountId:
          expenseType === "DIRECT_BUSINESS" && paymentType === "PAID_IMMEDIATELY"
            ? bankAccountId
            : null,
        lines: lines.map((l) => ({
          categoryId: l.categoryId || null,
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          taxRate: Number(l.taxRate) || 0,
          notes: l.notes || null,
        })),
      };

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create expense");
      }

      router.push(`/expenses/${json.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred while saving the expense.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <Link
            href="/expenses"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Expenses
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-indigo-600" />
            Create Expense
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record a direct company operational expense or submit an employee reimbursement claim.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 flex items-center gap-2.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Document Classification */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            1. Classification & Disbursement Model
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExpenseType("DIRECT_BUSINESS")}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border text-center transition-colors ${
                    expenseType === "DIRECT_BUSINESS"
                      ? "bg-indigo-50 border-indigo-600 text-indigo-700"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Direct Business
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseType("EMPLOYEE_CLAIM")}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border text-center transition-colors ${
                    expenseType === "EMPLOYEE_CLAIM"
                      ? "bg-indigo-50 border-indigo-600 text-indigo-700"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Employee Claim
                </button>
              </div>
            </div>

            {expenseType === "DIRECT_BUSINESS" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentType}
                  onChange={(e: any) => setPaymentType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="PAID_IMMEDIATELY">Paid Immediately (Cash/Bank Outflow)</option>
                  <option value="ON_ACCOUNT">Incurred On Account (Accounts Payable)</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Claimant Employee *</label>
                <select
                  value={claimantId}
                  onChange={(e) => setClaimantId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="">Select Employee...</option>
                  {claimants.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
            {expenseType === "DIRECT_BUSINESS" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier / Vendor</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="">None / One-off Vendor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName || s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {expenseType === "DIRECT_BUSINESS" && paymentType === "PAID_IMMEDIATELY" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bank / Cash Account *</label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="">Select Account...</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.accountName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Date *</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description *</label>
            <input
              type="text"
              placeholder="e.g. Travel lodging for annual client conference"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
        </div>

        {/* Dynamic Line Items Editor */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">2. Expense Line Items</h2>
              <p className="text-[11px] text-slate-500">
                Itemize overhead expenditures. Totals previewed below are verified authoritatively on submission.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddLine}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Line
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                  <th className="py-2.5 px-3 min-w-[150px]">Category</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Description *</th>
                  <th className="py-2.5 px-3 w-20 text-right">Qty</th>
                  <th className="py-2.5 px-3 w-28 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 w-24 text-right">Tax Rate %</th>
                  <th className="py-2.5 px-3 w-28 text-right">Line Total</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, idx) => {
                  const lineSub = (line.quantity || 0) * (line.unitPrice || 0);
                  const lineTotal = lineSub + (lineSub * (line.taxRate || 0)) / 100;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3">
                        <select
                          value={line.categoryId || ""}
                          onChange={(e) => handleLineChange(idx, "categoryId", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                        >
                          <option value="">Default COA</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.code})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          placeholder="Line item details..."
                          value={line.description}
                          onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                          required
                          className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0.0001"
                          value={line.quantity}
                          onChange={(e) => handleLineChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                          required
                          className="w-full px-2 py-1.5 text-xs text-right rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.unitPrice}
                          onChange={(e) => handleLineChange(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                          required
                          className="w-full px-2 py-1.5 text-xs text-right rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={line.taxRate}
                          onChange={(e) => handleLineChange(idx, "taxRate", parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs text-right rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-800 font-mono">
                        {formatCurrency(lineTotal)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Remove line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Preview Summary */}
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Preview:</span>
                <span className="font-mono font-medium">{formatCurrency(previewTotals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax Total Preview:</span>
                <span className="font-mono font-medium">{formatCurrency(previewTotals.taxTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold text-sm pt-1 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="font-mono text-indigo-700">{formatCurrency(previewTotals.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Notes */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <label className="block text-xs font-semibold text-slate-700">Internal Notes & Justification</label>
          <textarea
            rows={3}
            placeholder="Add relevant business context, project code, or reimbursement details..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        {/* Form Submission Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/expenses"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving Expense..." : "Create Expense Document"}
          </button>
        </div>
      </form>
    </div>
  );
}
