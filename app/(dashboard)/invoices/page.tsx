"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Plus, Search, Receipt, CheckCircle, Ban, DollarSign, Printer } from "lucide-react";
import { InvoicePrintModal, InvoicePrintData } from "@/components/invoices/InvoicePrintModal";

interface Customer {
  id: string;
  customerNumber: string;
  displayName: string;
  legalName?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  billingAddressLine1?: string | null;
  billingCity?: string | null;
  billingCountry?: string | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
}

interface InvoiceLine {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  product?: { name: string; sku: string } | null;
  total?: number | string;
}

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  status: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  customer: Customer;
  notes?: string | null;
  lines?: InvoiceLine[];
  _count?: { lines: number };
}

/* ── 3D Floating Ledger Icon ── */
function FloatingLedgerIcon() {
  return (
    <div className="animate-float-3d animate-glow-pulse">
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_8px_24px_rgba(99,102,241,0.3)]"
      >
        {/* Book body */}
        <rect x="16" y="12" width="56" height="72" rx="4" fill="url(#ledger-gradient)" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5" />
        {/* Spine highlight */}
        <rect x="16" y="12" width="8" height="72" rx="4" fill="rgba(99,102,241,0.25)" />
        {/* Pages */}
        <rect x="28" y="24" width="36" height="2" rx="1" fill="rgba(148,163,184,0.3)" />
        <rect x="28" y="32" width="36" height="2" rx="1" fill="rgba(148,163,184,0.3)" />
        <rect x="28" y="40" width="28" height="2" rx="1" fill="rgba(148,163,184,0.3)" />
        <rect x="28" y="48" width="36" height="2" rx="1" fill="rgba(148,163,184,0.3)" />
        <rect x="28" y="56" width="20" height="2" rx="1" fill="rgba(148,163,184,0.3)" />
        <rect x="28" y="64" width="36" height="2" rx="1" fill="rgba(148,163,184,0.3)" />
        {/* Rupee sign circle */}
        <circle cx="68" cy="68" r="16" fill="rgba(99,102,241,0.9)" stroke="rgba(129,140,248,0.6)" strokeWidth="1.5" />
        <text x="68" y="74" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Inter, sans-serif">₨</text>
        {/* Top-right bookmark */}
        <path d="M60 12 L60 26 L66 20 L72 26 L72 12" fill="rgba(99,102,241,0.5)" />
        <defs>
          <linearGradient id="ledger-gradient" x1="16" y1="12" x2="72" y2="84" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(30,41,59,0.95)" />
            <stop offset="1" stopColor="rgba(15,23,42,0.95)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Print & Share modal state
  const [printInvoice, setPrintInvoice] = useState<InvoicePrintData | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([
    { description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
  ]);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [invRes, custRes, prodRes] = await Promise.all([
        fetch(`/api/invoices?search=${encodeURIComponent(search)}`),
        fetch("/api/customers?take=100"),
        fetch("/api/products?take=100"),
      ]);

      if (invRes.ok) {
        const data = await invRes.json();
        setInvoices(data.items || []);
      }
      if (custRes.ok) {
        const data = await custRes.json();
        setCustomers(data.items || []);
      }
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddLine = () => {
    setLines([...lines, { description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 }]);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      productId: productId || undefined,
      description: prod ? `${prod.name} (${prod.sku})` : updated[index].description,
      unitPrice: prod ? Number(prod.sellingPrice) : updated[index].unitPrice,
    };
    setLines(updated);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer,
          issueDate,
          dueDate,
          notes: notes || undefined,
          lines,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create invoice");
      }

      const createdInvoice = await res.json();

      setShowCreateModal(false);
      setSelectedCustomer("");
      setNotes("");
      setLines([{ description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 }]);
      fetchData();

      // Automatically open Print & Share modal for instant customer handoff
      setPrintInvoice(createdInvoice);
      setIsPrintModalOpen(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueInvoice = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}/issue`, { method: "POST" });
      if (res.ok) {
        alert("Invoice issued successfully! Stock deducted for inventoried products.");
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to issue invoice");
      }
    } catch (err) {
      console.error("Issue failed:", err);
    }
  };

  const handleVoidInvoice = async (id: string) => {
    if (!confirm("Are you sure you want to void this invoice? This will restore any deducted inventory.")) return;
    try {
      const res = await fetch(`/api/invoices/${id}/void`, { method: "POST" });
      if (res.ok) {
        alert("Invoice voided successfully.");
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to void invoice");
      }
    } catch (err) {
      console.error("Void failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white text-depth">Sales Invoices</h1>
          <p className="text-sm text-slate-400">Manage invoices, issue documents, and track customer payments.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-700 px-4 py-2 text-sm font-semibold text-white bevel-raised hover:from-indigo-400 hover:to-indigo-600 hover:shadow-glow-indigo transition-all duration-150"
        >
          <Plus className="h-4 w-4" />
          Create Invoice
        </button>
      </div>

      {/* Search bar — glass panel with recessed input */}
      <div className="flex items-center gap-3 rounded-xl glass-panel p-3 shadow-glass-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by invoice number or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/5 glass-input pl-9 pr-4 py-2 text-sm text-slate-300 placeholder:text-slate-500 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
          />
        </div>
      </div>

      {/* Data table — glass panel */}
      <div className="overflow-hidden rounded-xl glass-panel shadow-glass-md">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="border-b border-white/5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3">Invoice #</th>
              <th className="px-6 py-3">Customer</th>
              <th className="px-6 py-3">Due Date</th>
              <th className="px-6 py-3">Total</th>
              <th className="px-6 py-3">Balance Due</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">Loading invoices...</td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <FloatingLedgerIcon />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-400 text-depth-subtle">No invoices found</p>
                      <p className="text-xs text-slate-500">Create your first invoice to get started.</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-semibold text-indigo-400">{inv.invoiceNumber}</td>
                  <td className="px-6 py-4 font-medium text-slate-200">{inv.customer?.displayName}</td>
                  <td className="px-6 py-4 text-slate-400">{new Date(inv.dueDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-semibold text-slate-200">PKR {Number(inv.total).toFixed(2)}</td>
                  <td className="px-6 py-4 font-semibold text-slate-200">PKR {Number(inv.balanceDue).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                        inv.status === "PAID"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : inv.status === "VOID" || inv.status === "CANCELLED"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-white/5 text-slate-400 border-white/10"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                    <button
                      onClick={() => {
                        setPrintInvoice(inv);
                        setIsPrintModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                      title="Print or share invoice with customer"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print / Share
                    </button>
                    {inv.status === "DRAFT" && (
                      <button
                        onClick={() => handleIssueInvoice(inv.id)}
                        className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        Issue
                      </button>
                    )}
                    {(inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID") && (
                      <button
                        onClick={() => handleVoidInvoice(inv.id)}
                        className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Invoice Modal — glass backdrop + glass panel */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-2xl glass-panel shadow-glass-lg p-6 max-h-[90vh] overflow-y-auto border border-indigo-500/10">
            <h2 className="text-lg font-bold text-white mb-4 text-depth">Create Sales Invoice</h2>
            {error && <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">{error}</div>}

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400">Customer *</label>
                  <select
                    required
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 glass-input p-2 text-sm text-slate-200"
                  >
                    <option value="">Select Customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName} ({c.customerNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400">Issue Date *</label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 glass-input p-2 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 glass-input p-2 text-sm text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Line Items</label>
                <div className="space-y-3">
                  {lines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-center glass-surface p-3 rounded-lg border border-white/5">
                      <select
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="w-1/3 rounded-lg border border-white/10 glass-input p-1.5 text-xs text-slate-200"
                      >
                        <option value="">Select Item (Optional)...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} - PKR {Number(p.sellingPrice).toFixed(2)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Description *"
                        required
                        value={line.description}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].description = e.target.value;
                          setLines(updated);
                        }}
                        className="flex-1 rounded-lg border border-white/10 glass-input p-1.5 text-xs text-slate-200 placeholder:text-slate-500"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        required
                        min="1"
                        value={line.quantity}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].quantity = Number(e.target.value);
                          setLines(updated);
                        }}
                        className="w-16 rounded-lg border border-white/10 glass-input p-1.5 text-xs text-slate-200"
                      />
                      <input
                        type="number"
                        placeholder="Price (PKR)"
                        required
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].unitPrice = Number(e.target.value);
                          setLines(updated);
                        }}
                        className="w-28 rounded-lg border border-white/10 glass-input p-1.5 text-xs text-slate-200"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  + Add Line Item
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-white/10 glass-surface px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-700 px-4 py-2 text-sm font-semibold text-white bevel-raised hover:from-indigo-400 hover:to-indigo-600 hover:shadow-glow-indigo disabled:opacity-50 transition-all duration-150"
                >
                  {submitting ? "Saving & Preparing..." : "Save & Print Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Print & Share Modal */}
      <InvoicePrintModal
        invoice={printInvoice}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />
    </div>
  );
}
