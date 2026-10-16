"use client";

import * as React from "react";
import { InvoiceLogo } from "./InvoiceLogo";
import {
  MapPin,
  Phone,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  FileText,
  CreditCard,
  User,
} from "lucide-react";

export interface InvoiceDocumentData {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  status: string;
  notes?: string | null;
  total: number | string;
  amountPaid: number | string;
  balanceDue: number | string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  cashierName?: string | null;
  organization?: { name: string; logoUrl?: string | null } | null;
  customer?: {
    displayName: string;
    legalName?: string | null;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    billingAddressLine1?: string | null;
    billingCity?: string | null;
    billingCountry?: string | null;
  } | null;
  lines?: Array<{
    id?: string;
    description: string;
    quantity: number;
    unitPrice: number | string;
    taxRate?: number | string;
    taxAmount?: number | string;
    discount?: number | string;
    total?: number | string;
    unit?: string | null;
    barcode?: string | null;
    product?: {
      name: string;
      sku: string;
      barcode?: string | null;
      unitOfMeasure?: { symbol: string } | null;
    } | null;
  }>;
}

export function AdcarePharmacyLogo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Blue Medical Cross */}
        <path
          d="M38 10 C38 8 39.5 6 42 6 H58 C60.5 6 62 8 62 10 V38 H90 C92 38 94 39.5 94 42 V58 C94 60.5 92 62 90 62 H62 V90 C62 92 60.5 94 58 94 H42 C39.5 94 38 92 38 90 V62 H10 C8 62 6 60.5 6 58 V42 C6 39.5 8 38 10 38 H38 V10 Z"
          fill="#1d4ed8"
        />
        {/* Vibrant Green Leaf */}
        <path
          d="M14 74 C10 52 24 30 50 24 C52 38 48 60 34 76 C26 84 18 82 14 74 Z"
          fill="#16a34a"
        />
        {/* White Leaf Vein */}
        <path
          d="M49 26 C36 44 26 58 16 72"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function InvoiceDocument({ invoice }: { invoice: InvoiceDocumentData }) {
  if (!invoice) return null;

  const dateObj = invoice.issueDate ? new Date(invoice.issueDate) : new Date();
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const formattedTime = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    : "08:25 PM";

  const numTotal = Number(invoice.total || 0);
  const numPaid = Number(invoice.amountPaid || 0);
  const numBalance = Number(invoice.balanceDue || 0);
  const isPaid = invoice.status === "PAID" || numBalance <= 0;

  // Calculate subtotal, discounts, tax from lines if available
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  if (invoice.lines && invoice.lines.length > 0) {
    invoice.lines.forEach((l) => {
      const q = Number(l.quantity || 1);
      const p = Number(l.unitPrice || 0);
      const d = Number(l.discount || 0);
      const t = Number(l.taxAmount || 0);
      subtotal += q * p;
      totalDiscount += d;
      totalTax += t;
    });
  } else {
    subtotal = numTotal;
  }

  const customerName = invoice.customer?.displayName || "nomi";
  const customerPhone = invoice.customer?.phone || "03479121852";
  const customerAddress =
    [invoice.customer?.billingAddressLine1, invoice.customer?.billingCity, invoice.customer?.billingCountry]
      .filter(Boolean)
      .join(", ") || "Peshawar, Khyber Pakhtunkhwa";

  const cashier = invoice.cashierName || "Shop Owner";
  const paymentMethod = invoice.paymentMethod || "Cash";
  const paymentRef = invoice.paymentReference || "—";

  return (
    <div
      id="invoice-printable-area"
      className="w-full max-w-[800px] mx-auto bg-white text-slate-800 font-sans p-6 sm:p-8 rounded-lg shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full print:m-0"
      style={{ minHeight: "1050px" }}
    >
      {/* ── 1. Top Header ── */}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(140px,0.9fr)] sm:grid-cols-[auto_minmax(0,1fr)_224px] print:grid-cols-[auto_minmax(0,1fr)_224px] items-start gap-4 pb-4">
        {/* Left: Brand Logo & Text */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-baseline text-2xl font-black tracking-tight leading-none">
              <span className="text-[#1d4ed8]">AD </span>
              <span className="text-[#16a34a] ml-1.5">CARE</span>
            </div>
            <span className="text-xs font-bold text-[#1d4ed8] tracking-tight mt-1">
              Meds & Pharmacy
            </span>
          </div>
        </div>

        {/* Center: Store Information */}
        <div className="col-start-1 row-start-2 sm:col-start-2 sm:row-start-1 print:col-start-2 print:row-start-1 border-l border-slate-200 pl-4 space-y-1 text-xs text-slate-700">
          <h2 className="font-bold text-[#1d4ed8] text-sm leading-tight">
            Adcare Meds & Pharmacy
          </h2>
          <div className="flex items-center gap-1.5 text-slate-600">
            <MapPin className="h-3.5 w-3.5 text-[#1d4ed8] shrink-0" />
            <span>Peshawar, Khyber Pakhtunkhwa</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <Phone className="h-3.5 w-3.5 text-[#1d4ed8] shrink-0" />
            <span>0347 9121852</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <MessageSquare className="h-3.5 w-3.5 text-[#16a34a] shrink-0" />
            <span>WhatsApp: 0347 9121852</span>
          </div>
        </div>

        {/* Right: TAX INVOICE Box */}
        <div className="col-start-2 row-start-1 row-span-2 sm:col-start-3 sm:row-span-1 print:col-start-3 print:row-span-1 flex min-w-0 flex-col items-end">
          <InvoiceLogo logoUrl={invoice.organization?.logoUrl} name={invoice.organization?.name || "Business"} />
        <div className="w-full border border-[#1d4ed8] rounded-xl p-3 bg-white shadow-xs">
          <h3 className="text-center font-black text-lg text-[#1e3a8a] tracking-wider mb-2 border-b border-blue-100 pb-1">
            TAX INVOICE
          </h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Invoice No</span>
              <span className="font-bold text-slate-900">{invoice.invoiceNumber || "INV-2026-006"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Date</span>
              <span className="font-semibold text-slate-900">{formattedDate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Time</span>
              <span className="font-semibold text-slate-900">{formattedTime}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Cashier</span>
              <span className="font-semibold text-slate-900">{cashier}</span>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Blue Divider Line */}
      <div className="w-full h-[2.5px] bg-[#1d4ed8] my-3" />

      {/* ── 2. Bill To / Customer & Status ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 py-2 border-b border-slate-200">
        {/* Customer Details */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-[#1d4ed8] font-bold text-sm mb-1">
            <User className="h-4 w-4" />
            <span>Bill To / Customer</span>
          </div>
          <div className="grid grid-cols-[60px_1fr] gap-x-2 gap-y-0.5 text-xs">
            <span className="text-slate-600 font-medium">Name</span>
            <span className="font-semibold text-slate-900">{customerName}</span>

            <span className="text-slate-600 font-medium">Contact</span>
            <span className="text-slate-900">{customerPhone}</span>

            <span className="text-slate-600 font-medium">Address</span>
            <span className="text-slate-900">{customerAddress}</span>
          </div>
        </div>

        {/* Status Badge Box */}
        <div className="sm:self-center">
          {isPaid ? (
            <div className="border-2 border-[#16a34a] rounded-xl px-7 py-2.5 bg-emerald-50/40 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[#16a34a] font-black text-2xl tracking-wide">
                <CheckCircle2 className="h-6 w-6 stroke-[2.5]" />
                <span>PAID</span>
              </div>
              <p className="text-[11px] font-semibold text-[#16a34a] mt-0.5">
                Thank you for your payment!
              </p>
            </div>
          ) : (
            <div className="border-2 border-amber-500 rounded-xl px-7 py-2.5 bg-amber-50/40 text-center">
              <div className="flex items-center justify-center gap-1.5 text-amber-600 font-black text-2xl tracking-wide">
                <AlertCircle className="h-6 w-6 stroke-[2.5]" />
                <span>{invoice.status || "UNPAID"}</span>
              </div>
              <p className="text-[11px] font-semibold text-amber-600 mt-0.5">
                Balance Due: PKR {numBalance.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Line Items Table ── */}
      <div className="mt-4 mb-6 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-300 text-slate-800 text-[11px] font-bold uppercase tracking-wider">
              <th className="py-2.5 px-2 text-center w-8">#</th>
              <th className="py-2.5 px-2">BARCODE / SKU</th>
              <th className="py-2.5 px-3">PRODUCT NAME</th>
              <th className="py-2.5 px-2 text-center">UNIT</th>
              <th className="py-2.5 px-2 text-center">QTY</th>
              <th className="py-2.5 px-2 text-right">UNIT PRICE (PKR)</th>
              <th className="py-2.5 px-2 text-right">DISCOUNT (PKR)</th>
              <th className="py-2.5 px-2 text-right">TAX (PKR)</th>
              <th className="py-2.5 px-2 text-right font-black">TOTAL (PKR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoice.lines && invoice.lines.length > 0 ? (
              invoice.lines.map((item, idx) => {
                const qty = Number(item.quantity || 1);
                const price = Number(item.unitPrice || 0);
                const discount = Number(item.discount || 0);
                const tax = Number(item.taxAmount || 0);
                const lineTotal =
                  item.total !== undefined ? Number(item.total) : qty * price - discount + tax;
                const barcodeSku =
                  item.barcode || item.product?.barcode || item.product?.sku || customerPhone;
                const unitSymbol =
                  item.unit || item.product?.unitOfMeasure?.symbol || "pcs";

                return (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-2 text-center font-medium text-slate-700">{idx + 1}</td>
                    <td className="py-3 px-2 font-mono text-[11px] text-slate-700">{barcodeSku}</td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900 leading-tight">
                        {item.description || item.product?.name || "Alcare Meds & Pharmacy Online Home Service"}
                      </p>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="inline-block bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-sky-200">
                        {unitSymbol}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center font-semibold text-slate-900">{qty}</td>
                    <td className="py-3 px-2 text-right font-mono text-slate-800">
                      PKR {price.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-slate-600">
                      PKR {discount.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-slate-600">
                      PKR {tax.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-slate-950">
                      PKR {lineTotal.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="py-3 px-2 text-center font-medium text-slate-700">1</td>
                <td className="py-3 px-2 font-mono text-[11px] text-slate-700">{customerPhone}</td>
                <td className="py-3 px-3">
                  <p className="font-semibold text-slate-900 leading-tight">
                    Alcare Meds & Pharmacy Online Home Service
                  </p>
                </td>
                <td className="py-3 px-2 text-center">
                  <span className="inline-block bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-sky-200">
                    pcs
                  </span>
                </td>
                <td className="py-3 px-2 text-center font-semibold text-slate-900">1</td>
                <td className="py-3 px-2 text-right font-mono text-slate-800">
                  PKR {numTotal.toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-mono text-slate-600">PKR 0.00</td>
                <td className="py-3 px-2 text-right font-mono text-slate-600">PKR 0.00</td>
                <td className="py-3 px-2 text-right font-mono font-bold text-slate-950">
                  PKR {numTotal.toFixed(2)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── 4. Middle Bottom Section (Notes + Payment vs Totals) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pb-6">
        {/* Left Side: Notes/Terms & Payment Method */}
        <div className="space-y-4">
          {/* Notes / Terms Card */}
          <div className="border border-slate-300 rounded-xl p-3.5 bg-white shadow-2xs">
            <div className="flex items-center gap-1.5 text-[#1d4ed8] font-bold text-xs mb-2">
              <FileText className="h-4 w-4" />
              <span>NOTES / TERMS</span>
            </div>
            <ul className="text-[11px] text-slate-700 space-y-1 list-disc pl-4 leading-relaxed">
              <li>Goods once sold will not be taken back or exchanged.</li>
              <li>Prices are subject to change without prior notice.</li>
              <li>Please check items and change before leaving the store.</li>
              <li>Returns or exchanges accepted within 7 days with the original receipt.</li>
            </ul>
          </div>

          {/* Payment Method Card */}
          <div className="border border-slate-300 rounded-xl p-3.5 bg-white shadow-2xs">
            <div className="flex items-center gap-1.5 text-[#1d4ed8] font-bold text-xs mb-2">
              <CreditCard className="h-4 w-4" />
              <span>PAYMENT METHOD</span>
            </div>
            <div className="grid grid-cols-2 text-xs py-0.5">
              <span className="text-slate-600 font-medium">Method</span>
              <span className="text-right font-semibold text-slate-900">{paymentMethod}</span>
            </div>
            <div className="grid grid-cols-2 text-xs py-0.5">
              <span className="text-slate-600 font-medium">Reference No</span>
              <span className="text-right text-slate-900">{paymentRef}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Totals Card */}
        <div className="border border-slate-300 rounded-xl p-4 bg-white shadow-2xs space-y-2 text-xs">
          <div className="flex justify-between py-1 text-slate-700">
            <span className="font-medium">Subtotal</span>
            <span className="font-mono font-semibold text-slate-900">PKR {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 text-slate-700">
            <span className="font-medium">Discount</span>
            <span className="font-mono text-slate-800">–PKR {totalDiscount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 text-slate-700">
            <span className="font-medium">Tax</span>
            <span className="font-mono text-slate-800">PKR {totalTax.toFixed(2)}</span>
          </div>

          <div className="border-t border-slate-300 my-1" />

          <div className="flex justify-between py-1.5 text-base font-black text-slate-950">
            <span>Grand Total</span>
            <span className="font-mono tracking-tight">PKR {numTotal.toFixed(2)}</span>
          </div>

          <div className="border-t border-slate-300 my-1" />

          <div className="flex justify-between py-1 text-slate-700">
            <span className="font-medium">Paid Amount</span>
            <span className="font-mono font-semibold text-slate-900">PKR {numPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 text-[#1d4ed8] font-bold">
            <span>Current Due</span>
            <span className="font-mono">PKR {numBalance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 text-slate-700">
            <span className="font-medium">Changes</span>
            <span className="font-mono font-semibold text-slate-900">PKR 0.00</span>
          </div>
        </div>
      </div>

      {/* Blue Dividing Line Before Footer */}
      <div className="w-full h-[2px] bg-[#1d4ed8] my-4" />

      {/* ── 5. Footer Section ── */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs pt-1 pb-2">
        {/* Left: Thank You & Store Signature */}
        <div className="space-y-0.5 text-slate-700 text-center sm:text-left">
          <h4 className="font-black text-base text-[#1d4ed8]">Thank You</h4>
          <p className="text-[11px] text-slate-800">For choosing Adcare Meds & Pharmacy</p>
          <p className="text-[11px] text-slate-800">Online Home Service!</p>
          <p className="text-[11px] text-slate-600">Peshawar, Khyber Pakhtunkhwa</p>
        </div>

        {/* Center: Policy Statement */}
        <div className="text-center max-w-xs space-y-0.5">
          <p className="font-bold text-slate-900 text-xs">Return / Exchange Policy:</p>
          <p className="italic text-[10px] text-slate-600 leading-tight">
            Goods once sold will not be taken back or exchanged unless defective. Keep this invoice for any claim.
          </p>
        </div>

        {/* Right: Brand Signature Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col">
            <div className="flex items-baseline text-lg font-black tracking-tight leading-none">
              <span className="text-[#1d4ed8]">AD </span>
              <span className="text-[#16a34a] ml-1">CARE</span>
            </div>
            <span className="text-[10px] font-bold text-[#1d4ed8] tracking-tight mt-0.5">
              Meds & Pharmacy
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
