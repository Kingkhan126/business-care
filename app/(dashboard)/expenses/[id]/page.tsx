"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Receipt,
  ArrowLeft,
  Send,
  CheckCircle2,
  XCircle,
  FileCheck2,
  CreditCard,
  Ban,
  Clock,
  UploadCloud,
  FileText,
  Trash2,
  AlertCircle,
  Building,
  User,
  Calendar,
  Landmark,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ExpenseDetail {
  id: string;
  expenseNumber: string;
  expenseType: "DIRECT_BUSINESS" | "EMPLOYEE_CLAIM";
  status:
    | "DRAFT"
    | "SUBMITTED"
    | "APPROVED"
    | "POSTED"
    | "PAID"
    | "REJECTED"
    | "CANCELLED"
    | "VOIDED";
  paymentType: "PAID_IMMEDIATELY" | "ON_ACCOUNT";
  expenseDate: string;
  dueDate?: string | null;
  description: string;
  notes?: string | null;
  rejectionReason?: string | null;
  currency: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  claimantId?: string | null;
  claimant?: { id: string; name: string; email: string } | null;
  supplier?: { id: string; displayName: string } | null;
  category?: { id: string; name: string; code: string } | null;
  bankAccount?: { id: string; accountName: string } | null;
  createdBy: { id: string; name: string; email: string };
  approvedBy?: { id: string; name: string; email: string } | null;
  approvedAt?: string | null;
  postedAt?: string | null;
  paidAt?: string | null;
  journalEntry?: {
    id: string;
    journalNumber: string;
    status: string;
    totalDebit: number;
    postingDate: string;
  } | null;
  reimbursementJournal?: {
    id: string;
    journalNumber: string;
    status: string;
    totalDebit: number;
    postingDate: string;
  } | null;
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    subtotal: number;
    taxAmount: number;
    total: number;
    notes?: string | null;
    category?: { id: string; name: string; code: string } | null;
  }>;
  attachments: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
    createdAt: string;
    uploadedBy: { id: string; name: string };
  }>;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  permissions: string[];
}

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const expenseId = params.id as string;

  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: string; accountName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Workflow Dialog States
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payBankAccountId, setPayBankAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentReference, setPaymentReference] = useState("");
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  // Attachment Upload State
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileError, setFileError] = useState("");

  // Fetch Current User & Permissions
  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        setCurrentUser(json.user);
      }
    } catch (e) {
      console.error("Failed to load user profile", e);
    }
  };

  // Fetch Bank Accounts for Payment Modal
  const fetchBankAccounts = async () => {
    try {
      const res = await fetch("/api/banking/accounts?isActive=true");
      if (res.ok) {
        const json = await res.json();
        setBankAccounts(json.data || []);
      }
    } catch (e) {
      console.error("Failed to load bank accounts", e);
    }
  };

  // Fetch Expense Data
  const fetchExpense = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      const res = await fetch(`/api/expenses/${expenseId}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Expense not found");
      }
      setExpense(json);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load expense");
    } finally {
      setLoading(false);
    }
  }, [expenseId]);

  useEffect(() => {
    fetchCurrentUser();
    fetchBankAccounts();
    fetchExpense();
  }, [fetchExpense]);

  const hasPerm = (perm: string) => {
    return currentUser?.permissions?.includes(perm) || false;
  };

  // Action Handlers
  const handleSubmitExpense = async () => {
    try {
      setActionLoading(true);
      setErrorMessage("");
      const res = await fetch(`/api/expenses/${expenseId}/submit`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit expense");
      setSuccessMessage("Expense successfully submitted for approval.");
      fetchExpense();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveExpense = async () => {
    try {
      setActionLoading(true);
      setErrorMessage("");
      const res = await fetch(`/api/expenses/${expenseId}/approve`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to approve expense");
      setShowApproveModal(false);
      setSuccessMessage("Expense approved successfully.");
      fetchExpense();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectExpense = async () => {
    if (!rejectReason.trim()) {
      setErrorMessage("Rejection reason is required.");
      return;
    }
    try {
      setActionLoading(true);
      setErrorMessage("");
      const res = await fetch(`/api/expenses/${expenseId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reject expense");
      setShowRejectModal(false);
      setRejectReason("");
      setSuccessMessage("Expense rejected.");
      fetchExpense();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostExpense = async () => {
    try {
      setActionLoading(true);
      setErrorMessage("");
      const res = await fetch(`/api/expenses/${expenseId}/post`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to post expense to General Ledger");
      setShowPostModal(false);
      setSuccessMessage("Expense posted to General Ledger successfully.");
      fetchExpense();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayExpense = async () => {
    if (!payBankAccountId) {
      setErrorMessage("Please select a bank account for disbursement.");
      return;
    }
    try {
      setActionLoading(true);
      setErrorMessage("");
      const res = await fetch(`/api/expenses/${expenseId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId: payBankAccountId,
          paymentDate,
          reference: paymentReference || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to execute reimbursement/payment");
      setShowPayModal(false);
      setSuccessMessage("Payment successfully executed and recorded in banking & GL.");
      fetchExpense();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidExpense = async () => {
    try {
      setActionLoading(true);
      setErrorMessage("");
      const res = await fetch(`/api/expenses/${expenseId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to void expense");
      setShowVoidModal(false);
      setVoidReason("");
      setSuccessMessage("Expense voided and accounting reversals generated.");
      fetchExpense();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError("");

    // Client-side validations
    if (file.size > 10 * 1024 * 1024) {
      setFileError("File exceeds maximum allowed size of 10MB.");
      return;
    }

    const allowedMimes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedMimes.includes(file.type)) {
      setFileError("Only PDF, JPEG, PNG, and WEBP files are allowed. SVG and executables are rejected.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadingFile(true);
      const res = await fetch(`/api/expenses/${expenseId}/attachments`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to upload attachment");
      fetchExpense();
    } catch (err: any) {
      setFileError(err.message);
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm("Are you sure you want to remove this attachment?")) return;
    try {
      const res = await fetch(`/api/expenses/${expenseId}/attachments?attachmentId=${attachmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete attachment");
      }
      fetchExpense();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
        Loading expense document...
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-3">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Expense Not Found</h2>
        <p className="text-xs text-slate-500">The requested expense does not exist or access is restricted.</p>
        <Link
          href="/expenses"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Expenses
        </Link>
      </div>
    );
  }

  // Anti-self-approval check: User cannot approve their own claim
  const isSelfClaimant = expense.expenseType === "EMPLOYEE_CLAIM" && expense.claimantId === currentUser?.id;

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Top Navigation & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link
            href="/expenses"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Expenses
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {expense.expenseNumber}
            </h1>
            <Badge
              variant={
                expense.status === "PAID"
                  ? "success"
                  : expense.status === "APPROVED"
                  ? "success"
                  : expense.status === "POSTED"
                  ? "warning"
                  : expense.status === "REJECTED" || expense.status === "VOIDED"
                  ? "error"
                  : "info"
              }
            >
              {expense.status}
            </Badge>
            <span className="text-xs text-slate-500">
              {expense.expenseType === "EMPLOYEE_CLAIM" ? "Employee Claim" : "Direct Business Expense"}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">{expense.description}</p>
        </div>

        {/* Workflow Actions Button Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* DRAFT or REJECTED: Submit */}
          {(expense.status === "DRAFT" || expense.status === "REJECTED") && hasPerm("expense.submit") && (
            <button
              onClick={handleSubmitExpense}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              Submit for Approval
            </button>
          )}

          {/* SUBMITTED: Approve & Reject */}
          {expense.status === "SUBMITTED" && (
            <>
              {hasPerm("expense.approve") && (
                <button
                  onClick={() => setShowApproveModal(true)}
                  disabled={actionLoading || isSelfClaimant}
                  title={isSelfClaimant ? "Claimants are strictly prohibited from approving their own claims" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve Claim
                </button>
              )}
              {hasPerm("expense.reject") && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
              )}
            </>
          )}

          {/* APPROVED: Post to GL */}
          {expense.status === "APPROVED" && hasPerm("expense.post") && (
            <button
              onClick={() => setShowPostModal(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              Post to General Ledger
            </button>
          )}

          {/* POSTED: Pay / Reimburse */}
          {expense.status === "POSTED" && hasPerm("expense.pay") && (
            <button
              onClick={() => setShowPayModal(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <CreditCard className="h-3.5 w-3.5" />
              {expense.expenseType === "EMPLOYEE_CLAIM" ? "Reimburse Employee" : "Pay Expense"}
            </button>
          )}

          {/* POSTED or PAID: Void (where permitted) */}
          {(expense.status === "POSTED" || expense.status === "PAID") && hasPerm("expense.manage") && (
            <button
              onClick={() => setShowVoidModal(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Ban className="h-3.5 w-3.5" />
              Void Expense
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 flex items-center gap-2.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Anti-self-approval Warning Banner if applicable */}
      {isSelfClaimant && expense.status === "SUBMITTED" && (
        <div className="rounded-lg bg-amber-50 p-3.5 border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
          <ShieldCheck className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span>
            You are the claimant on this expense claim. Internal financial controls strictly prohibit claimants from approving their own claims.
          </span>
        </div>
      )}

      {/* Rejection Notice if rejected */}
      {expense.rejectionReason && expense.status === "REJECTED" && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 space-y-1">
          <span className="text-xs font-bold text-red-900 uppercase tracking-wider">Rejection Justification:</span>
          <p className="text-xs text-red-700">{expense.rejectionReason}</p>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Document Total</span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {formatCurrency(Number(expense.total))}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5">Currency: {expense.currency}</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Expense Date</span>
          <div className="text-sm font-semibold text-slate-800 mt-1">
            {formatDate(expense.expenseDate)}
          </div>
          {expense.dueDate && (
            <span className="text-[11px] text-slate-400">Due: {formatDate(expense.dueDate)}</span>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Beneficiary / Payee</span>
          <div className="text-sm font-semibold text-slate-800 mt-1 truncate">
            {expense.claimant?.name || expense.supplier?.displayName || "N/A"}
          </div>
          <span className="text-[11px] text-slate-400">
            {expense.expenseType === "EMPLOYEE_CLAIM" ? "Reimbursable Employee" : "Supplier / Vendor"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Disbursement Method</span>
          <div className="text-sm font-semibold text-slate-800 mt-1">
            {expense.paymentType === "PAID_IMMEDIATELY" ? "Immediate Cash/Bank" : "On Account (Payable)"}
          </div>
          <span className="text-[11px] text-slate-400">
            {expense.bankAccount?.accountName || "Settled on reimbursement"}
          </span>
        </div>
      </div>

      {/* Itemized Line Items */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
          Line Item Details
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Tax Rate %</th>
                <th className="py-2.5 px-3 text-right">Subtotal</th>
                <th className="py-2.5 px-3 text-right">Tax Amount</th>
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {expense.lines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-sans">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                      {line.category?.name || "General Overhead"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-900">{line.description}</td>
                  <td className="py-2.5 px-3 text-right">{Number(line.quantity).toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right">{formatCurrency(Number(line.unitPrice))}</td>
                  <td className="py-2.5 px-3 text-right">{line.taxRate}%</td>
                  <td className="py-2.5 px-3 text-right">{formatCurrency(Number(line.subtotal))}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">
                    {formatCurrency(Number(line.taxAmount))}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                    {formatCurrency(Number(line.total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Document Totals */}
        <div className="flex justify-end pt-3 border-t border-slate-100">
          <div className="w-64 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-medium">{formatCurrency(Number(expense.subtotal))}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Input Tax Recoverable:</span>
              <span className="font-mono font-medium">{formatCurrency(Number(expense.taxTotal))}</span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold text-sm pt-1 border-t border-slate-200">
              <span>Total Document:</span>
              <span className="font-mono text-indigo-700">{formatCurrency(Number(expense.total))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* General Ledger & Banking Linkages */}
      {(expense.journalEntry || expense.reimbursementJournal) && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Landmark className="h-4 w-4 text-indigo-600" />
            Accounting & Banking Traceability
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {expense.journalEntry && (
              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-1">
                <span className="font-semibold text-slate-700">Accrual Journal Entry:</span>
                <div className="font-mono text-indigo-600 font-bold">
                  {expense.journalEntry.journalNumber}
                </div>
                <div className="text-slate-500 text-[11px]">
                  Posted: {formatDate(expense.journalEntry.postingDate)} | Status: {expense.journalEntry.status}
                </div>
              </div>
            )}

            {expense.reimbursementJournal && (
              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-1">
                <span className="font-semibold text-slate-700">Disbursement / Settlement Journal:</span>
                <div className="font-mono text-emerald-600 font-bold">
                  {expense.reimbursementJournal.journalNumber}
                </div>
                <div className="text-slate-500 text-[11px]">
                  Posted: {formatDate(expense.reimbursementJournal.postingDate)} | Status: {expense.reimbursementJournal.status}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipts & Supporting Attachments */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-indigo-600" />
              Receipts & Supporting Documentation
            </h2>
            <p className="text-[11px] text-slate-500">
              Audit-compliant receipt storage. Accepted formats: PDF, JPEG, PNG, WEBP (Max 10MB).
            </p>
          </div>

          {/* Upload Button */}
          {hasPerm("expense.attachments") && (
            <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors">
              <UploadCloud className="h-3.5 w-3.5" />
              {uploadingFile ? "Uploading..." : "Attach Receipt"}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileUpload}
                disabled={uploadingFile}
              />
            </label>
          )}
        </div>

        {fileError && (
          <div className="rounded-lg bg-red-50 p-2.5 border border-red-200 text-xs text-red-700">
            {fileError}
          </div>
        )}

        {expense.attachments.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            No receipts or documents attached to this expense yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {expense.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors bg-slate-50/50"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <FileText className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                  <div className="truncate">
                    <a
                      href={att.storagePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-slate-900 hover:underline truncate block"
                    >
                      {att.fileName}
                    </a>
                    <span className="text-[10px] text-slate-400">
                      {(att.fileSize / 1024).toFixed(1)} KB • {formatDate(att.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={att.storagePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-slate-400 hover:text-indigo-600"
                    title="View file"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  {hasPerm("expense.attachments") && (
                    <button
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="p-1 text-slate-400 hover:text-red-600"
                      title="Delete attachment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval Confirmation Dialog */}
      <Dialog
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Expense Claim"
        description={`Are you sure you want to approve expense ${expense.expenseNumber} for ${formatCurrency(
          Number(expense.total)
        )}?`}
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-600">
            Approving authorizes the expense for General Ledger posting and disbursement.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowApproveModal(false)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApproveExpense}
              disabled={actionLoading}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {actionLoading ? "Approving..." : "Confirm Approval"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Reject Modal */}
      <Dialog
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Expense Claim"
        description="Provide a mandatory reason for rejecting this claim."
      >
        <div className="space-y-4 pt-2">
          <textarea
            rows={3}
            placeholder="Specify reason (e.g. Missing receipt, exceeds per diem threshold)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowRejectModal(false)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectExpense}
              disabled={actionLoading || !rejectReason.trim()}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? "Rejecting..." : "Confirm Rejection"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Post to GL Dialog */}
      <Dialog
        isOpen={showPostModal}
        onClose={() => setShowPostModal(false)}
        title="Post Expense to General Ledger"
        description={`This will generate authoritative double-entry accounting entries for ${formatCurrency(
          Number(expense.total)
        )}.`}
      >
        <div className="space-y-3 pt-2 text-xs text-slate-600">
          <p>
            Posting will record debit entries for itemized expense accounts and credit to{" "}
            <strong>
              {expense.expenseType === "EMPLOYEE_CLAIM"
                ? "Employee Reimbursements Payable"
                : "Accounts Payable / Bank"}
            </strong>
            .
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowPostModal(false)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handlePostExpense}
              disabled={actionLoading}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {actionLoading ? "Posting..." : "Confirm GL Posting"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Pay / Reimburse Dialog */}
      <Dialog
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        title={expense.expenseType === "EMPLOYEE_CLAIM" ? "Reimburse Employee" : "Pay Expense"}
        description={`Execute disbursement settlement of ${formatCurrency(Number(expense.total))}.`}
      >
        <div className="space-y-4 pt-2 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Disbursement Bank Account *</label>
            <select
              value={payBankAccountId}
              onChange={(e) => setPayBankAccountId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">Select Bank Account...</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.accountName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Payment Date *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Payment Reference</label>
            <input
              type="text"
              placeholder="e.g. Wire Ref # / Check #"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowPayModal(false)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handlePayExpense}
              disabled={actionLoading || !payBankAccountId}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {actionLoading ? "Executing Settlement..." : "Confirm Disbursement"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Void Dialog */}
      <Dialog
        isOpen={showVoidModal}
        onClose={() => setShowVoidModal(false)}
        title="Void Expense"
        description="Voiding will mark this expense VOIDED and generate accounting reversal entries."
      >
        <div className="space-y-4 pt-2 text-xs">
          <p className="text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
            Warning: If already posted or reimbursed, reversing journal entries will be created in the current open period and bank balances will be restored.
          </p>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Voiding</label>
            <textarea
              rows={2}
              placeholder="Explain why this expense is being voided..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowVoidModal(false)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleVoidExpense}
              disabled={actionLoading}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? "Voiding..." : "Confirm Void"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
