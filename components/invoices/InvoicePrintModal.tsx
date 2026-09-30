"use client";

import * as React from "react";
import { Printer, Share2, Copy, Check, X, Building2, Phone, Mail, MapPin } from "lucide-react";

export interface InvoicePrintData {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  notes?: string | null;
  total: number | string;
  amountPaid: number | string;
  balanceDue: number | string;
  customer: {
    displayName: string;
    legalName?: string | null;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    billingAddressLine1?: string | null;
    billingCity?: string | null;
    billingCountry?: string | null;
  };
  lines?: Array<{
    id?: string;
    description: string;
    quantity: number;
    unitPrice: number | string;
    taxRate?: number | string;
    taxAmount?: number | string;
    subtotal?: number | string;
    total?: number | string;
    product?: { name: string; sku: string } | null;
  }>;
}

interface InvoicePrintModalProps {
  invoice: InvoicePrintData | null;
  isOpen: boolean;
  onClose: () => void;
  orgName?: string;
}

export function InvoicePrintModal({ invoice, isOpen, onClose, orgName }: InvoicePrintModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !invoice) return null;

  const companyTitle = orgName || "AD CARE & MEDS PHARMACY";
  const numTotal = Number(invoice.total || 0).toFixed(2);
  const numPaid = Number(invoice.amountPaid || 0).toFixed(2);
  const numBalance = Number(invoice.balanceDue || 0).toFixed(2);

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = async () => {
    try {
      const lineDetails = (invoice.lines || [])
        .map(
          (l, i) =>
            `${i + 1}. ${l.description} x ${l.quantity} @ PKR ${Number(l.unitPrice).toFixed(2)} = PKR ${(
              Number(l.quantity) * Number(l.unitPrice)
            ).toFixed(2)}`
        )
        .join("\n");

      const text = `
*${companyTitle}*
Invoice: ${invoice.invoiceNumber}
Date: ${new Date(invoice.issueDate).toLocaleDateString()}
Due: ${new Date(invoice.dueDate).toLocaleDateString()}
Status: ${invoice.status}

Bill To: ${invoice.customer?.displayName || "Customer"}
${invoice.customer?.phone ? `Phone: ${invoice.customer.phone}` : ""}

Items:
${lineDetails || "No items"}

Total: PKR ${numTotal}
Amount Paid: PKR ${numPaid}
Balance Due: PKR ${numBalance}

Thank you for choosing ${companyTitle}!
      `.trim();

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (e) {
      console.error("Failed to copy summary", e);
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoice.invoiceNumber} - ${companyTitle}`,
          text: `Invoice ${invoice.invoiceNumber} for PKR ${numTotal} from ${companyTitle}. Balance Due: PKR ${numBalance}.`,
        });
      } catch {
        handleCopySummary();
      }
    } else {
      handleCopySummary();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 print:p-0 print:bg-white print:static print:z-0">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl glass-panel shadow-2xl border border-indigo-500/20 overflow-hidden print:border-none print:shadow-none print:max-h-none print:rounded-none">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/90 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Invoice Preview & Print</h2>
            <span className="text-xs font-mono text-indigo-300 ml-2 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
              {invoice.invoiceNumber}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy Summary"}
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              <Share2 className="h-3.5 w-3.5 text-indigo-400" />
              Share
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document View */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950/60 print:p-0 print:bg-white print:overflow-visible">
          <div
            id="invoice-printable-area"
            className="mx-auto w-full max-w-3xl bg-white text-slate-900 rounded-xl shadow-lg p-8 sm:p-10 border border-slate-200 print:shadow-none print:border-none print:p-4 print:max-w-full"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                    +
                  </div>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-950 uppercase">{companyTitle}</h1>
                    <p className="text-xs text-indigo-600 font-medium tracking-wide">
                      Pharmaceutical & Healthcare Services
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                  <p className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400" /> Saddar Road, Peshawar, KP, Pakistan
                  </p>
                  <p className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-slate-400" /> +92 91 1234567 / +92 300 0000000
                  </p>
                  <p className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-slate-400" /> info@adcaremeds.com
                  </p>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="inline-block text-2xl font-black text-indigo-950 tracking-wider">SALES INVOICE</span>
                <div className="mt-1 font-mono text-sm font-bold text-indigo-600">#{invoice.invoiceNumber}</div>
                <div className="mt-2 inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full border border-slate-300 bg-slate-50 text-slate-700 uppercase">
                  {invoice.status}
                </div>
              </div>
            </div>

            {/* Bill To & Invoice Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200 text-xs">
              <div>
                <span className="font-bold uppercase tracking-wider text-slate-500 block mb-1">Billed To</span>
                <p className="text-sm font-bold text-slate-900">{invoice.customer?.displayName}</p>
                {invoice.customer?.legalName && (
                  <p className="text-slate-600">{invoice.customer.legalName}</p>
                )}
                {invoice.customer?.contactPerson && (
                  <p className="text-slate-600 mt-1">Attn: {invoice.customer.contactPerson}</p>
                )}
                {invoice.customer?.phone && (
                  <p className="text-slate-600">Phone: {invoice.customer.phone}</p>
                )}
                {invoice.customer?.email && (
                  <p className="text-slate-600">Email: {invoice.customer.email}</p>
                )}
                {[invoice.customer?.billingAddressLine1, invoice.customer?.billingCity, invoice.customer?.billingCountry]
                  .filter(Boolean)
                  .join(", ") && (
                  <p className="text-slate-600 mt-0.5">
                    {[invoice.customer?.billingAddressLine1, invoice.customer?.billingCity, invoice.customer?.billingCountry]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>

              <div className="sm:text-right space-y-1.5">
                <div>
                  <span className="text-slate-500 font-medium">Issue Date: </span>
                  <span className="font-semibold text-slate-900">
                    {new Date(invoice.issueDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Due Date: </span>
                  <span className="font-semibold text-slate-900">
                    {new Date(invoice.dueDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Billing Currency: </span>
                  <span className="font-mono font-bold text-indigo-700">PKR (₨)</span>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="py-6">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-300 text-slate-600 uppercase text-[11px] font-semibold">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 px-2">Item & Description</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2 text-right">Unit Price</th>
                    <th className="py-2 pl-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.lines && invoice.lines.length > 0 ? (
                    invoice.lines.map((line, idx) => {
                      const qty = Number(line.quantity || 0);
                      const unitPrice = Number(line.unitPrice || 0);
                      const lineTotal = line.total !== undefined ? Number(line.total) : qty * unitPrice;
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-3 pr-2 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-3 px-2">
                            <p className="font-semibold text-slate-900">{line.description}</p>
                            {line.product?.sku && (
                              <p className="text-[10px] font-mono text-slate-500">SKU: {line.product.sku}</p>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center font-mono text-slate-800">{qty}</td>
                          <td className="py-3 px-2 text-right font-mono text-slate-800">
                            PKR {unitPrice.toFixed(2)}
                          </td>
                          <td className="py-3 pl-2 text-right font-mono font-semibold text-slate-900">
                            PKR {lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        Standard sales transaction
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t-2 border-slate-200">
              <div className="text-xs text-slate-500 max-w-sm">
                <span className="font-bold text-slate-700 block mb-1">Payment Instructions / Notes</span>
                <p className="text-[11px] leading-relaxed">
                  {invoice.notes ||
                    "Payment due according to specified terms. Bank transfer or cash payments accepted at checkout counters."}
                </p>
              </div>

              <div className="w-full sm:w-64 space-y-1.5 text-xs">
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium text-slate-900">PKR {numTotal}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Amount Paid:</span>
                  <span className="font-mono font-medium text-emerald-600">PKR {numPaid}</span>
                </div>
                <div className="flex justify-between py-2 border-t-2 border-slate-900 font-bold text-sm text-slate-950">
                  <span>Balance Due:</span>
                  <span className="font-mono text-indigo-700">PKR {numBalance}</span>
                </div>
              </div>
            </div>

            {/* Footer / Stamp */}
            <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
              <p>Computer generated invoice. No signature required.</p>
              <div className="flex items-center gap-1 font-medium text-slate-600">
                <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                <span>{companyTitle}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
