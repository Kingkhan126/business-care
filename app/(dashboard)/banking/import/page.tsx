"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Landmark,
  ShieldCheck,
  Check,
} from "lucide-react";

export default function StatementImportPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [bankAccountId, setBankAccountId] = useState("");
  const [fileName, setFileName] = useState("bank_statement.csv");
  const [csvContent, setCsvContent] = useState("");

  const [mapping, setMapping] = useState({
    dateColumn: "Date",
    descriptionColumn: "Description",
    amountColumn: "Amount",
    inflowColumn: "",
    outflowColumn: "",
    referenceColumn: "Reference",
    payeeColumn: "Payee",
    dateFormat: "YYYY-MM-DD",
    delimiter: ",",
    hasHeader: true,
  });

  const [previewData, setPreviewData] = useState<any>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch("/api/banking/accounts")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setAccounts(json.data.items || []);
      })
      .finally(() => setLoadingAccounts(false));
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handlePreview = async () => {
    setErrorMsg("");
    setParsing(true);
    try {
      const res = await fetch("/api/banking/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId,
          csvContent,
          mapping: {
            ...mapping,
            amountColumn: mapping.amountColumn || null,
            inflowColumn: mapping.inflowColumn || null,
            outflowColumn: mapping.outflowColumn || null,
            referenceColumn: mapping.referenceColumn || null,
            payeeColumn: mapping.payeeColumn || null,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to parse CSV statement");

      setPreviewData(json.data);
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleCommit = async () => {
    setErrorMsg("");
    setCommitting(true);
    try {
      const res = await fetch("/api/banking/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId,
          fileName,
          csvContent,
          mapping: {
            ...mapping,
            amountColumn: mapping.amountColumn || null,
            inflowColumn: mapping.inflowColumn || null,
            outflowColumn: mapping.outflowColumn || null,
            referenceColumn: mapping.referenceColumn || null,
            payeeColumn: mapping.payeeColumn || null,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to commit import batch");

      setCommitResult(json.data);
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
        <Link href="/banking" className="hover:text-indigo-600">Banking</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Statement Import</span>
      </div>
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-amber-600" />
          Bank Statement Import Wizard
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Import CSV statements with customizable column mapping and automated cryptographic duplicate protection.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Step Progress Indicator */}
      <div className="flex items-center justify-between max-w-xl mx-auto py-2">
        <div className={`flex items-center gap-2 font-semibold text-xs ${step >= 1 ? "text-indigo-600" : "text-slate-400"}`}>
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}>
            1
          </div>
          Upload & Map
        </div>
        <div className="h-0.5 w-16 bg-slate-200" />
        <div className={`flex items-center gap-2 font-semibold text-xs ${step >= 2 ? "text-indigo-600" : "text-slate-400"}`}>
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}>
            2
          </div>
          Preview & Dedup
        </div>
        <div className="h-0.5 w-16 bg-slate-200" />
        <div className={`flex items-center gap-2 font-semibold text-xs ${step >= 3 ? "text-indigo-600" : "text-slate-400"}`}>
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}>
            3
          </div>
          Summary
        </div>
      </div>

      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900">Step 1: Choose Account & File</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Destination Bank Account *
                </label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- Select Bank Account --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} ({a.accountType}) - ${Number(a.currentBalance).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Upload CSV Statement File
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                CSV Content (or paste manually)
              </label>
              <textarea
                rows={6}
                placeholder="Date,Description,Amount,Reference&#10;2026-10-01,Client Wire Deposit,2500.00,REF1001&#10;2026-10-03,Office Rent Payment,-1200.00,CHQ881"
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Column Mapping Section */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Step 2: Column Headers Mapping</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Date Column *
                </label>
                <input
                  type="text"
                  value={mapping.dateColumn}
                  onChange={(e) => setMapping({ ...mapping, dateColumn: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Description Column *
                </label>
                <input
                  type="text"
                  value={mapping.descriptionColumn}
                  onChange={(e) => setMapping({ ...mapping, descriptionColumn: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Signed Amount Column
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amount"
                  value={mapping.amountColumn || ""}
                  onChange={(e) => setMapping({ ...mapping, amountColumn: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Reference Column
                </label>
                <input
                  type="text"
                  placeholder="e.g. Reference"
                  value={mapping.referenceColumn || ""}
                  onChange={(e) => setMapping({ ...mapping, referenceColumn: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handlePreview}
              disabled={!bankAccountId || !csvContent || parsing}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {parsing ? "Parsing..." : "Preview & Validate"} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && previewData && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Statement Preview & Deduplication</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Target Account: <span className="font-semibold text-slate-800">{previewData.accountName}</span> &bull; File: {fileName}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800">
                {previewData.newRowsCount} New
              </span>
              {previewData.duplicateCount > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800">
                  {previewData.duplicateCount} Duplicates Skipped
                </span>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 uppercase">Total Rows</span>
              <div className="text-lg font-bold text-slate-900">{previewData.totalRows}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 uppercase">Inflow Sum</span>
              <div className="text-lg font-bold text-emerald-600">+${previewData.totalInflow.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 uppercase">Outflow Sum</span>
              <div className="text-lg font-bold text-rose-600">-${previewData.totalOutflow.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 uppercase">Net Impact</span>
              <div className="text-lg font-bold text-slate-900">${previewData.netAmount.toFixed(2)}</div>
            </div>
          </div>

          {/* Parsed Rows Preview */}
          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 font-semibold uppercase text-slate-500 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Row #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.rows.map((r: any) => (
                  <tr key={r.rowNumber} className={r.isDuplicate ? "bg-amber-50/50" : "hover:bg-slate-50"}>
                    <td className="py-2 px-3 font-mono text-slate-400">{r.rowNumber}</td>
                    <td className="py-2 px-3 font-mono">{new Date(r.transactionDate).toISOString().split("T")[0]}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{r.description}</td>
                    <td className="py-2 px-3 font-mono">{r.reference || "—"}</td>
                    <td className={`py-2 px-3 text-right font-mono font-bold ${r.amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      ${r.amount.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {r.isDuplicate ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                          Duplicate (Skip)
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                          Ready to Import
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              &larr; Back to Mapping
            </button>
            <button
              onClick={handleCommit}
              disabled={committing || previewData.newRowsCount === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {committing ? "Importing..." : `Commit ${previewData.newRowsCount} Transactions`}
            </button>
          </div>
        </div>
      )}

      {step === 3 && commitResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center space-y-5">
          <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-9 w-9" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">Statement Imported Successfully!</h2>
            <p className="text-sm text-slate-500 mt-1">
              Batch <span className="font-mono font-semibold text-slate-800">{commitResult.batchId}</span> has been processed into the account register.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto py-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500">Imported</span>
              <div className="text-xl font-bold text-emerald-600">{commitResult.importedRecords}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500">Skipped Duplicates</span>
              <div className="text-xl font-bold text-amber-600">{commitResult.skippedDuplicates}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500">Net Balance Delta</span>
              <div className="text-xl font-bold text-slate-900">${commitResult.netImportedAmount.toFixed(2)}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-3">
            <Link
              href={`/banking/accounts/${bankAccountId}`}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              View Account Register
            </Link>
            <Link
              href="/banking/matching"
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Go to Matching Hub &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
