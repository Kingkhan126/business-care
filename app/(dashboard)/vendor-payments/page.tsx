"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Plus, Search, CreditCard } from "lucide-react";

interface Supplier {
  id: string;
  supplierNumber: string;
  displayName: string;
}

interface Bill {
  id: string;
  billNumber: string;
  balanceDue: number;
  total: number;
}

interface VendorPayment {
  id: string;
  paymentNumber: string;
  supplierId: string;
  paymentDate: string;
  amount: number;
  unallocatedAmount: number;
  paymentMethod: string;
  reference?: string;
  supplier: Supplier;
  allocations?: Array<{ id: string; allocatedAmount: number; bill: { billNumber: string } }>;
}

export default function VendorPaymentsPage() {
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [openBills, setOpenBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<VendorPayment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");

  // Allocation Form State
  const [selectedBillId, setSelectedBillId] = useState("");
  const [allocationAmount, setAllocationAmount] = useState<number>(0);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [payRes, suppRes] = await Promise.all([
        fetch(`/api/vendor-payments?search=${encodeURIComponent(search)}`),
        fetch("/api/suppliers?take=100"),
      ]);

      if (payRes.ok) {
        const data = await payRes.json();
        setPayments(data.items || []);
      }
      if (suppRes.ok) {
        const data = await suppRes.json();
        setSuppliers(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch vendor payments:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/vendor-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: selectedSupplier,
          paymentDate,
          amount: Number(amount),
          paymentMethod,
          reference: reference || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to record vendor payment");
      }

      setShowRecordModal(false);
      setSelectedSupplier("");
      setAmount(0);
      setReference("");
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAllocate = async (payment: VendorPayment) => {
    setSelectedPayment(payment);
    setSelectedBillId("");
    setAllocationAmount(Number(payment.unallocatedAmount));
    setError(null);

    try {
      const res = await fetch(`/api/vendor-bills?supplierId=${payment.supplierId}&take=100`);
      if (res.ok) {
        const data = await res.json();
        const unpaid = (data.items || []).filter(
          (b: any) => (b.status === "RECEIVED" || b.status === "PARTIALLY_PAID") && Number(b.balanceDue) > 0
        );
        setOpenBills(unpaid);
      }
    } catch (err) {
      console.error("Failed to fetch open bills:", err);
    }

    setShowAllocateModal(true);
  };

  const handleAllocatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/vendor-payments/${selectedPayment.id}/allocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId: selectedBillId,
          allocatedAmount: Number(allocationAmount),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to allocate payment");
      }

      setShowAllocateModal(false);
      setSelectedPayment(null);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vendor Payments</h1>
          <p className="text-sm text-slate-500">Record payments to suppliers and allocate against open vendor bills.</p>
        </div>
        <button
          onClick={() => setShowRecordModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Record Vendor Payment
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by payment number, reference, or supplier..."
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
              <th className="px-6 py-3">Payment #</th>
              <th className="px-6 py-3">Supplier</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Method</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Unallocated</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-400">Loading vendor payments...</td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-400">No vendor payments recorded yet.</td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-semibold text-indigo-600">{p.paymentNumber}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{p.supplier?.displayName}</td>
                  <td className="px-6 py-4">{new Date(p.paymentDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-mono text-xs">{p.paymentMethod}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900">${Number(p.amount).toFixed(2)}</td>
                  <td className="px-6 py-4 font-semibold text-emerald-600">${Number(p.unallocatedAmount).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    {Number(p.unallocatedAmount) > 0 && (
                      <button
                        onClick={() => handleOpenAllocate(p)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Allocate to Bill
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Record Vendor Payment</h2>
            {error && <div className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-600">{error}</div>}

            <form onSubmit={handleRecordPayment} className="space-y-4">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Amount ($) *</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={amount || ""}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Reference Number</label>
                <input
                  type="text"
                  placeholder="Txn ID / Cheque #"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAllocateModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Allocate Payment #{selectedPayment.paymentNumber}</h2>
            <p className="text-xs text-slate-500 mb-4">
              Supplier: {selectedPayment.supplier?.displayName} | Available: ${Number(selectedPayment.unallocatedAmount).toFixed(2)}
            </p>
            {error && <div className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-600">{error}</div>}

            <form onSubmit={handleAllocatePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">Target Vendor Bill *</label>
                <select
                  required
                  value={selectedBillId}
                  onChange={(e) => {
                    setSelectedBillId(e.target.value);
                    const b = openBills.find((i) => i.id === e.target.value);
                    if (b) {
                      setAllocationAmount(Math.min(Number(selectedPayment.unallocatedAmount), Number(b.balanceDue)));
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                >
                  <option value="">Select Open Vendor Bill...</option>
                  {openBills.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.billNumber} - Balance Due: ${Number(b.balanceDue).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Allocation Amount ($) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  max={Number(selectedPayment.unallocatedAmount)}
                  step="0.01"
                  value={allocationAmount || ""}
                  onChange={(e) => setAllocationAmount(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Allocating..." : "Confirm Allocation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
