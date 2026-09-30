"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Plus, Search, FileText, ArrowRight, CheckCircle, XCircle } from "lucide-react";

interface Customer {
  id: string;
  customerNumber: string;
  displayName: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
}

interface EstimateLine {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
}

interface Estimate {
  id: string;
  estimateNumber: string;
  customerId: string;
  issueDate: string;
  expiryDate?: string;
  status: string;
  total: number;
  customer: Customer;
  _count?: { lines: number };
}

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Estimate Form State
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EstimateLine[]>([
    { description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
  ]);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [estRes, custRes, prodRes] = await Promise.all([
        fetch(`/api/estimates?search=${encodeURIComponent(search)}`),
        fetch("/api/customers?take=100"),
        fetch("/api/products?take=100"),
      ]);

      if (estRes.ok) {
        const data = await estRes.json();
        setEstimates(data.items || []);
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
      console.error("Failed to fetch estimates:", err);
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

  const handleRemoveLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, idx) => idx !== index));
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

  const handleCreateEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer,
          issueDate,
          notes: notes || undefined,
          lines,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create estimate");
      }

      setShowCreateModal(false);
      setSelectedCustomer("");
      setNotes("");
      setLines([{ description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 }]);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/estimates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleConvertToOrder = async (id: string) => {
    try {
      const res = await fetch(`/api/estimates/${id}/convert`, { method: "POST" });
      if (res.ok) {
        alert("Estimate successfully converted to Sales Order!");
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to convert estimate");
      }
    } catch (err) {
      console.error("Conversion failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Estimates & Quotations</h1>
          <p className="text-sm text-slate-500">Manage commercial estimates, quotes, and sales conversions.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Create Estimate
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by estimate number or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Estimates Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3">Estimate #</th>
              <th className="px-6 py-3">Customer</th>
              <th className="px-6 py-3">Issue Date</th>
              <th className="px-6 py-3">Total Amount</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading estimates...</td>
              </tr>
            ) : estimates.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No estimates found. Click &apos;Create Estimate&apos; to add one.</td>
              </tr>
            ) : (
              estimates.map((est) => (
                <tr key={est.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-semibold text-indigo-600">{est.estimateNumber}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{est.customer?.displayName}</td>
                  <td className="px-6 py-4">{new Date(est.issueDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900">${Number(est.total).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        est.status === "ACCEPTED"
                          ? "bg-emerald-100 text-emerald-800"
                          : est.status === "SENT"
                          ? "bg-blue-100 text-blue-800"
                          : est.status === "CONVERTED"
                          ? "bg-purple-100 text-purple-800"
                          : est.status === "DECLINED" || est.status === "CANCELLED"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {est.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {est.status === "DRAFT" && (
                      <button
                        onClick={() => handleStatusChange(est.id, "SENT")}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Mark Sent
                      </button>
                    )}
                    {est.status === "SENT" && (
                      <>
                        <button
                          onClick={() => handleStatusChange(est.id, "ACCEPTED")}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleStatusChange(est.id, "DECLINED")}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {est.status === "ACCEPTED" && (
                      <button
                        onClick={() => handleConvertToOrder(est.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800"
                      >
                        Convert to SO <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Create New Estimate</h2>
            {error && <div className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-600">{error}</div>}

            <form onSubmit={handleCreateEstimate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Customer *</label>
                  <select
                    required
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
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
                  <label className="block text-xs font-medium text-slate-700">Issue Date *</label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Line Items</label>
                <div className="space-y-3">
                  {lines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <select
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="w-1/3 rounded-lg border border-slate-300 p-1.5 text-xs"
                      >
                        <option value="">Select Item (Optional)...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} - ${Number(p.sellingPrice).toFixed(2)}
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
                        className="flex-1 rounded-lg border border-slate-300 p-1.5 text-xs"
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
                        className="w-16 rounded-lg border border-slate-300 p-1.5 text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        required
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[idx].unitPrice = Number(e.target.value);
                          setLines(updated);
                        }}
                        className="w-24 rounded-lg border border-slate-300 p-1.5 text-xs"
                      />
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-rose-500 hover:text-rose-700 text-xs font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  + Add Line Item
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Estimate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
