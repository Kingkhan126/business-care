"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Plus, Search, FileText, ArrowRight } from "lucide-react";

interface Supplier {
  id: string;
  supplierNumber: string;
  displayName: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
}

interface POLine {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
}

interface PurchaseOrder {
  id: string;
  purchaseOrderNumber: string;
  supplierId: string;
  orderDate: string;
  status: string;
  total: number;
  supplier: Supplier;
  _count?: { lines: number };
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<POLine[]>([
    { description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 },
  ]);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [poRes, suppRes, prodRes] = await Promise.all([
        fetch(`/api/purchase-orders?search=${encodeURIComponent(search)}`),
        fetch("/api/suppliers?take=100"),
        fetch("/api/products?take=100"),
      ]);

      if (poRes.ok) {
        const data = await poRes.json();
        setOrders(data.items || []);
      }
      if (suppRes.ok) {
        const data = await suppRes.json();
        setSuppliers(data.items || []);
      }
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch purchase orders:", err);
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
      unitPrice: prod ? Number(prod.costPrice) : updated[index].unitPrice,
    };
    setLines(updated);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: selectedSupplier,
          orderDate,
          notes: notes || undefined,
          lines,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create Purchase Order");
      }

      setShowCreateModal(false);
      setSelectedSupplier("");
      setNotes("");
      setLines([{ description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 }]);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertToBill = async (id: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}/convert`, { method: "POST" });
      if (res.ok) {
        alert("Purchase Order converted to Draft Vendor Bill!");
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to convert PO");
      }
    } catch (err) {
      console.error("Conversion failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Purchase Orders</h1>
          <p className="text-sm text-slate-500">Manage supplier purchase orders and convert to vendor bills.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Create Purchase Order
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by PO number or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3">PO #</th>
              <th className="px-6 py-3">Supplier</th>
              <th className="px-6 py-3">Order Date</th>
              <th className="px-6 py-3">Total Amount</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading purchase orders...</td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No purchase orders found.</td>
              </tr>
            ) : (
              orders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-semibold text-indigo-600">{po.purchaseOrderNumber}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{po.supplier?.displayName}</td>
                  <td className="px-6 py-4">{new Date(po.orderDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900">${Number(po.total).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        po.status === "CONFIRMED"
                          ? "bg-emerald-100 text-emerald-800"
                          : po.status === "COMPLETED"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {po.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {po.status === "CONFIRMED" && (
                      <button
                        onClick={() => handleConvertToBill(po.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Convert to Bill <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Create Purchase Order</h2>
            {error && <div className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-600">{error}</div>}

            <form onSubmit={handleCreatePO} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Supplier *</label>
                  <select
                    required
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayName} ({s.supplierNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Order Date *</label>
                  <input
                    type="date"
                    required
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                  />
                </div>
              </div>

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
                            {p.name} - Cost: ${Number(p.costPrice).toFixed(2)}
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
                        placeholder="Cost"
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
                  {submitting ? "Saving..." : "Save Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
