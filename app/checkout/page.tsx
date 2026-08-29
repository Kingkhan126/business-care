"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ShieldCheck, CreditCard, Banknote, Wallet, Building2, Pill, CheckCircle2, ArrowLeft } from "lucide-react";

interface CartItem {
  id: string;
  name: string;
  price: number;
  isPrescriptionRequired: boolean;
  imageUrl?: string | null;
  quantity: number;
}

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [fullName, setFullName] = useState("John Doe");
  const [phone, setPhone] = useState("+1-555-0142");
  const [street, setStreet] = useState("742 Evergreen Terrace");
  const [city, setCity] = useState("Springfield");
  const [state, setState] = useState("IL");
  const [zipCode, setZipCode] = useState("62704");
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [prescriptionId, setPrescriptionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderComplete, setOrderComplete] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("medicare_cart");
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shippingFee = subtotal > 50 ? 0 : 4.99;
  const grandTotal = subtotal + shippingFee;
  const hasRxItem = items.some((item) => item.isPrescriptionRequired);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          address: { fullName, phone, street, city, state, zipCode, country: "USA" },
          paymentMethod,
          prescriptionId: prescriptionId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to place order.");
      }

      // Clear local cart
      localStorage.removeItem("medicare_cart");
      setOrderComplete(data);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header />
        <main className="max-w-xl mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 shadow-md text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Order Placed Successfully!</h1>
            <p className="text-xs text-slate-500 mt-1">
              Order Reference Number: <span className="font-mono font-bold text-teal-700">{orderComplete.orderNumber}</span>
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-2 text-left border border-slate-200">
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500">Order Status:</span>
              <span className="font-bold text-teal-800">{orderComplete.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Amount Charged:</span>
              <span className="font-bold text-slate-900">${orderComplete.totalAmount?.toFixed(2)}</span>
            </div>
          </div>

          {orderComplete.status === "PRESCRIPTION_VERIFICATION" && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 text-left">
              <span className="font-bold block">Pharmacist Review Required</span>
              Your prescription medication is currently under licensed pharmacist verification before dispatch.
            </div>
          )}

          <div className="flex justify-center space-x-4 pt-2">
            <Link
              href="/account/orders"
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-md transition"
            >
              View Order History →
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        <div className="flex items-center space-x-2">
          <Link href="/cart" className="text-xs text-slate-500 hover:text-teal-600 flex items-center">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Cart
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Secure Pharmacy Checkout</h1>
          <p className="text-xs text-slate-500 mt-1">Enter delivery address & payment details</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Delivery Address */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                1. Delivery Address
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Street Address *</label>
                  <input
                    type="text"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State & Zip Code *</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-1/2 p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className="w-1/2 p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Prescription Selection if Rx required */}
            {hasRxItem && (
              <div className="bg-amber-50/70 p-6 rounded-2xl border border-amber-200 shadow-xs space-y-3 text-xs">
                <h2 className="text-sm font-bold text-amber-900 flex items-center">
                  <Pill className="w-4 h-4 text-amber-700 mr-2" />
                  2. Prescription Attachment (Rx Required)
                </h2>
                <p className="text-amber-800">
                  Your order contains prescription medication. If you have already uploaded a prescription, enter your Prescription Reference ID below, or complete checkout and upload your doctor's Rx afterwards.
                </p>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Enter Prescription Reference ID (Optional)"
                    value={prescriptionId}
                    onChange={(e) => setPrescriptionId(e.target.value)}
                    className="flex-1 p-2 bg-white border border-amber-300 rounded-lg text-xs"
                  />
                  <Link
                    href="/prescriptions/upload"
                    target="_blank"
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shrink-0 text-xs"
                  >
                    Upload Rx in New Tab
                  </Link>
                </div>
              </div>
            )}

            {/* Payment Method */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                3. Payment Method
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label
                  onClick={() => setPaymentMethod("CARD")}
                  className={`p-4 rounded-xl border cursor-pointer flex items-center space-x-3 transition ${
                    paymentMethod === "CARD" ? "border-teal-600 bg-teal-50/50 ring-2 ring-teal-500" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-teal-600" />
                  <div>
                    <span className="font-bold block text-slate-900">Credit / Debit Card</span>
                    <span className="text-[11px] text-slate-500">Instant encrypted payment</span>
                  </div>
                </label>

                <label
                  onClick={() => setPaymentMethod("CASH_ON_DELIVERY")}
                  className={`p-4 rounded-xl border cursor-pointer flex items-center space-x-3 transition ${
                    paymentMethod === "CASH_ON_DELIVERY" ? "border-teal-600 bg-teal-50/50 ring-2 ring-teal-500" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Banknote className="w-5 h-5 text-teal-600" />
                  <div>
                    <span className="font-bold block text-slate-900">Cash on Delivery</span>
                    <span className="text-[11px] text-slate-500">Pay when medicine arrives</span>
                  </div>
                </label>

                <label
                  onClick={() => setPaymentMethod("WALLET")}
                  className={`p-4 rounded-xl border cursor-pointer flex items-center space-x-3 transition ${
                    paymentMethod === "WALLET" ? "border-teal-600 bg-teal-50/50 ring-2 ring-teal-500" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Wallet className="w-5 h-5 text-teal-600" />
                  <div>
                    <span className="font-bold block text-slate-900">Digital Health Wallet</span>
                    <span className="text-[11px] text-slate-500">AD CARE Meds balance</span>
                  </div>
                </label>

                <label
                  onClick={() => setPaymentMethod("BANK_TRANSFER")}
                  className={`p-4 rounded-xl border cursor-pointer flex items-center space-x-3 transition ${
                    paymentMethod === "BANK_TRANSFER" ? "border-teal-600 bg-teal-50/50 ring-2 ring-teal-500" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Building2 className="w-5 h-5 text-teal-600" />
                  <div>
                    <span className="font-bold block text-slate-900">Online Bank Transfer</span>
                    <span className="text-[11px] text-slate-500">Direct wire transfer</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Summary Column */}
          <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Order Items ({items.length})
            </h2>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1 font-medium text-slate-800">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="font-bold text-slate-900 ml-2">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-xs border-t border-slate-100 pt-4">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping Fee</span>
                <span>{shippingFee === 0 ? "FREE" : `$${shippingFee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t border-slate-200 pt-3">
                <span>Total Payment</span>
                <span className="text-teal-700">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || items.length === 0}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? "Processing Order..." : `Place Order ($${grandTotal.toFixed(2)})`}</span>
            </button>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
