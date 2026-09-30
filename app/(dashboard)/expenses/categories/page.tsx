"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FolderTree,
  Plus,
  ArrowLeft,
  Edit2,
  PowerOff,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Landmark,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";

interface Category {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  taxRate: number;
  isActive: boolean;
  linkedExpenseAccountId?: string | null;
  linkedExpenseAccount?: {
    id: string;
    accountCode: string;
    accountName: string;
  } | null;
  _count?: { expenses: number };
}

interface LedgerAccount {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  isActive: boolean;
  allowPosting: boolean;
}

export default function ExpenseCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [linkedExpenseAccountId, setLinkedExpenseAccountId] = useState("");
  const [taxRate, setTaxRate] = useState(0);

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await fetch("/api/expenses/categories?includeInactive=true");
      if (!res.ok) throw new Error("Failed to load categories");
      const data = await res.json();
      setCategories(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch GL Accounts
  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/accounting/accounts");
      if (res.ok) {
        const json = await res.json();
        setAccounts(json.data || []);
      }
    } catch (e) {
      console.error("Failed to load accounts", e);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchAccounts();
  }, [fetchCategories]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setCode("");
    setName("");
    setDescription("");
    setLinkedExpenseAccountId("");
    setTaxRate(0);
    setErrorMsg("");
    setShowModal(true);
  };

  const openEditModal = (cat: Category) => {
    setModalMode("edit");
    setEditingId(cat.id);
    setCode(cat.code);
    setName(cat.name);
    setDescription(cat.description || "");
    setLinkedExpenseAccountId(cat.linkedExpenseAccountId || "");
    setTaxRate(cat.taxRate || 0);
    setErrorMsg("");
    setShowModal(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setErrorMsg("Category Name and Code are required.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg("");

      const payload = {
        name,
        code,
        description: description || null,
        linkedExpenseAccountId: linkedExpenseAccountId || null,
        taxRate: Number(taxRate) || 0,
      };

      let res;
      if (modalMode === "create") {
        res = await fetch("/api/expenses/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/expenses/categories/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save category");
      }

      setShowModal(false);
      setSuccessMsg(`Category '${name}' saved successfully.`);
      fetchCategories();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDeactivate = async (cat: Category) => {
    const actionName = cat.isActive ? "deactivate" : "reactivate";
    if (!confirm(`Are you sure you want to ${actionName} category '${cat.name}'?`)) return;

    try {
      if (cat.isActive) {
        const res = await fetch(`/api/expenses/categories/${cat.id}`, { method: "DELETE" });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed to deactivate category");
        }
      } else {
        const res = await fetch(`/api/expenses/categories/${cat.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed to reactivate category");
        }
      }
      setSuccessMsg(`Category '${cat.name}' status updated.`);
      fetchCategories();
    } catch (err: any) {
      setErrorMsg(err.message || "Operation failed");
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link
            href="/expenses"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Expenses
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <FolderTree className="h-6 w-6 text-indigo-600" />
            Expense Categories & COA Linkages
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Define organizational spending categories mapped to General Ledger chart of accounts.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Category
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Categories Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Linked GL Account</th>
                <th className="py-3 px-4 text-right">Default Tax %</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-600 mb-2" />
                    Loading categories...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No expense categories configured. Click &quot;New Category&quot; to initialize one.
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{cat.code}</td>
                    <td className="py-3 px-4 font-semibold text-indigo-700">{cat.name}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={cat.description || ""}>
                      {cat.description || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-mono">
                      {cat.linkedExpenseAccount ? (
                        <span>
                          {cat.linkedExpenseAccount.accountCode} - {cat.linkedExpenseAccount.accountName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Default Operating Expense</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">
                      {cat.taxRate}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={cat.isActive ? "success" : "outline"}>
                        {cat.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(cat)}
                        className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-100"
                        title="Edit category"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleDeactivate(cat)}
                        className={`p-1 rounded hover:bg-slate-100 ${
                          cat.isActive ? "text-slate-400 hover:text-red-600" : "text-emerald-600"
                        }`}
                        title={cat.isActive ? "Deactivate" : "Activate"}
                      >
                        <PowerOff className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalMode === "create" ? "Create Expense Category" : "Edit Expense Category"}
        description="Configure spending taxonomy and chart of accounts mapping."
      >
        <form onSubmit={handleSaveCategory} className="space-y-4 pt-2 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category Code *</label>
              <input
                type="text"
                placeholder="e.g. TRAVEL"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category Name *</label>
              <input
                type="text"
                placeholder="e.g. Travel & Transportation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Linked General Ledger Account</label>
            <select
              value={linkedExpenseAccountId}
              onChange={(e) => setLinkedExpenseAccountId(e.target.value)}
              className="w-full px-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">Default Operating Expense (Account 5000)</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountCode} - {acc.accountName} ({acc.accountType})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Double-entry postings will debit this expense account when expenses in this category are posted.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Default Tax Rate %</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Guidance on which items belong to this category..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-3.5 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 font-semibold disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Category"}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
