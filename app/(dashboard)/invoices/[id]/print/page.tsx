"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { InvoiceDocument, InvoiceDocumentData } from "@/components/invoices/InvoiceDocument";
import { printInvoice } from "@/lib/printing/print-invoice";

export default function InvoicePrintPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvoice() {
      if (!params?.id) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/invoices/${params.id}`);
        if (!res.ok) {
          throw new Error("Failed to load invoice details");
        }
        const data = await res.json();
        setInvoice(data);
      } catch (err: any) {
        setError(err.message || "Error loading invoice");
      } finally {
        setLoading(false);
      }
    }
    loadInvoice();
  }, [params?.id]);

  const handlePrint = () => printInvoice();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-2 text-indigo-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm font-medium">Loading Tax Invoice...</span>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
        <div className="text-center space-y-3">
          <p className="text-rose-400 font-semibold">{error || "Invoice not found"}</p>
          <button
            onClick={() => router.push("/invoices")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8 print:p-0 print:bg-white">
      {/* Top action bar (hidden when printing) */}
      <div className="max-w-[800px] mx-auto mb-6 flex items-center justify-between print:hidden">
        <button
          onClick={() => router.push("/invoices")}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </button>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
        >
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      {/* The Printable Tax Invoice Document */}
      <InvoiceDocument invoice={invoice} />
    </div>
  );
}
