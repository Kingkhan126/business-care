"use client";

import * as React from "react";
import { Printer, Share2, Copy, Check, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { InvoiceDocument, InvoiceDocumentData } from "./InvoiceDocument";

interface InvoicePrintModalProps {
  invoice: InvoiceDocumentData | null;
  isOpen: boolean;
  onClose: () => void;
  orgName?: string;
}

export function InvoicePrintModal({ invoice, isOpen, onClose }: InvoicePrintModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !invoice) return null;

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
*Adcare Meds & Pharmacy*
Invoice No: ${invoice.invoiceNumber}
Date: ${invoice.issueDate ? new Date(invoice.issueDate).toISOString().split("T")[0] : ""}
Status: ${invoice.status}

Bill To: ${invoice.customer?.displayName || "nomi"}
Contact: ${invoice.customer?.phone || "0347 9121852"}

Items:
${lineDetails || "Alcare Meds & Pharmacy Online Home Service x 1 = PKR " + Number(invoice.total).toFixed(2)}

Grand Total: PKR ${Number(invoice.total || 0).toFixed(2)}
Paid Amount: PKR ${Number(invoice.amountPaid || 0).toFixed(2)}
Current Due: PKR ${Number(invoice.balanceDue || 0).toFixed(2)}

Thank you for choosing Adcare Meds & Pharmacy!
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
          title: `Tax Invoice ${invoice.invoiceNumber} - Adcare Meds & Pharmacy`,
          text: `Tax Invoice ${invoice.invoiceNumber} for PKR ${Number(invoice.total).toFixed(2)} from Adcare Meds & Pharmacy.`,
        });
      } catch {
        handleCopySummary();
      }
    } else {
      handleCopySummary();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 print:p-0 print:bg-white print:static print:z-0">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[96vh] rounded-2xl glass-panel shadow-2xl border border-indigo-500/20 overflow-hidden print:border-none print:shadow-none print:max-h-none print:rounded-none">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-slate-900/90 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm sm:text-base font-bold text-white">Tax Invoice Preview</h2>
            <span className="text-xs font-mono text-indigo-300 ml-1 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
              {invoice.invoiceNumber}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              title="Copy text summary"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? "Copied!" : "Copy Summary"}</span>
            </button>

            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              title="Share invoice"
            >
              <Share2 className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Share</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
              title="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-950/70 print:p-0 print:bg-white print:overflow-visible">
          <InvoiceDocument invoice={invoice} />
        </div>

        {/* Bottom Pagination / Toolbar (As seen in the uploaded invoice viewer) */}
        <div className="flex items-center justify-center py-2.5 px-4 bg-slate-900 border-t border-white/10 print:hidden shrink-0">
          <div className="inline-flex items-center bg-slate-950/90 text-slate-200 border border-white/10 rounded-lg p-1 text-xs shadow-inner">
            <button
              className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="First page"
              disabled
            >
              <ChevronsLeft className="h-3.5 w-3.5 opacity-40" />
            </button>
            <button
              className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Previous page"
              disabled
            >
              <ChevronLeft className="h-3.5 w-3.5 opacity-40" />
            </button>
            <div className="px-3 font-medium select-none border-x border-white/10 mx-1">
              1 of 1
            </div>
            <button
              className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Next page"
              disabled
            >
              <ChevronRight className="h-3.5 w-3.5 opacity-40" />
            </button>
            <button
              className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Last page"
              disabled
            >
              <ChevronsRight className="h-3.5 w-3.5 opacity-40" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-export type for backwards compatibility
export type { InvoiceDocumentData as InvoicePrintData };
