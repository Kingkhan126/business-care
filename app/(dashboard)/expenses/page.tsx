"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Send,
  CheckCircle2,
  XCircle,
  FileCheck2,
  CreditCard,
  Ban,
  Clock,
  ArrowRight,
  TrendingUp,
  FolderTree,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ExpenseSummary {
  summary: {
    count: number;
    subtotal: number;
    taxTotal: number;
    total: number;
  };
  statusBreakdown: Array<{
    status: string;
    count: number;
    total: number;
  }>;
  typeBreakdown: Array<{
    expenseType: string;
    count: number;
    total: number;
  }>;
}

interface ExpenseItem {
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
  description: string;
  currency: string;
  total: number;
  claimant?: { id: string; name: string; email: string } | null;
  supplier?: { id: string; displayName: string } | null;
  category?: { id: string; name: string; code: string } | null;
  bankAccount?: { id: string; accountName: string } | null;
  _count?: { lines: number; attachments: number };
}

interface CategoryOption {
  id: string;
  name: string;
  code: string;
}

export default function ExpensesDashboardPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [reportSummary, setReportSummary] = useState<ExpenseSummary | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Filter States
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [skip, setSkip] = useState(0);
  const take = 20;

  // Fetch Authoritative Report Summary
  const fetchReportSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (typeFilter) params.set("expenseType", typeFilter);

      const res = await fetch(`/api/expenses/reports?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setReportSummary(json);
      }
    } catch (err) {
      console.error("Failed to load expense report summary", err);
    } finally {
      setLoadingSummary(false);
    }
  }, [startDate, endDate, categoryFilter, typeFilter]);

  // Fetch Categories for Filter Dropdown
  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/expenses/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data || []);
      }
    } catch (err) {
      console.error("Failed to load categories", err);
    }
  };

  // Fetch Expenses List
  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("expenseType", typeFilter);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("skip", String(skip));
      params.set("take", String(take));

      const res = await fetch(`/api/expenses?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load expenses");
      }
      setExpenses(json.items || []);
      setTotalCount(json.total || 0);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, categoryFilter, startDate, endDate, skip]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchReportSummary();
  }, [fetchReportSummary]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setCategoryFilter("");
    setStartDate("");
    setEndDate("");
    setSkip(0);
  };

  const getStatusBadge = (status: ExpenseItem["status"]) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="outline">Draft</Badge>;
      case "SUBMITTED":
        return <Badge variant="info">Submitted</Badge>;
      case "APPROVED":
        return <Badge variant="success">Approved</Badge>;
      case "POSTED":
        return <Badge variant="warning">Posted (GL)</Badge>;
      case "PAID":
        return <Badge variant="success">Paid / Reimbursed</Badge>;
      case "REJECTED":
        return <Badge variant="error">Rejected</Badge>;
      case "CANCELLED":
        return <Badge variant="outline">Cancelled</Badge>;
      case "VOIDED":
        return <Badge variant="error">Voided</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStatusMetric = (statusName: string) => {
    if (!reportSummary) return { count: 0, total: 0 };
    const found = reportSummary.statusBreakdown.find((s) => s.status === statusName);
    return found ? { count: found.count, total: found.total } : { count: 0, total: 0 };
  };

  const draftMetric = getStatusMetric("DRAFT");
  const submittedMetric = getStatusMetric("SUBMITTED");
  const approvedMetric = getStatusMetric("APPROVED");
  const postedMetric = getStatusMetric("POSTED");
  const paidMetric = getStatusMetric("PAID");

  const totalPages = Math.ceil(totalCount / take) || 1;
  const currentPage = Math.floor(skip / take) + 1;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Receipt className="h-7 w-7 text-indigo-600" />
            Expense Management & Reimbursements
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Authoritative tracking of operational overhead, employee claims, double-entry GL posting, and banking disbursements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/expenses/categories"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <FolderTree className="h-4 w-4 text-slate-500" />
            Categories
          </Link>
          <Link
            href="/expenses/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Expense
          </Link>
        </div>
      </div>

      {/* Authoritative Aggregate Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Incurred</span>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900">
            {loadingSummary ? "..." : formatCurrency(reportSummary?.summary.total || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {loadingSummary ? "..." : `${reportSummary?.summary.count || 0} expenses`}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Drafts</span>
            <Clock className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-800">
            {loadingSummary ? "..." : formatCurrency(draftMetric.total)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{draftMetric.count} draft</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-sky-700">Submitted</span>
            <Send className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-sky-950">
            {loadingSummary ? "..." : formatCurrency(submittedMetric.total)}
          </div>
          <div className="text-[11px] text-sky-600 mt-0.5">{submittedMetric.count} pending approval</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700">Approved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-emerald-950">
            {loadingSummary ? "..." : formatCurrency(approvedMetric.total)}
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5">{approvedMetric.count} ready to post</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700">Posted (GL)</span>
            <FileCheck2 className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-amber-950">
            {loadingSummary ? "..." : formatCurrency(postedMetric.total)}
          </div>
          <div className="text-[11px] text-amber-600 mt-0.5">{postedMetric.count} awaiting pay</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700">Paid / Reimbursed</span>
            <CreditCard className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-emerald-900">
            {loadingSummary ? "..." : formatCurrency(paidMetric.total)}
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5">{paidMetric.count} settled</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSkip(0);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSkip(0);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="POSTED">Posted (GL)</option>
              <option value="PAID">Paid / Reimbursed</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="VOIDED">Voided</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setSkip(0);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">All Types</option>
              <option value="DIRECT_BUSINESS">Direct Business Expense</option>
              <option value="EMPLOYEE_CLAIM">Employee Claim</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setSkip(0);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setSkip(0);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* End Date */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSkip(0);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
        </div>

        {/* Clear Filters Indicator */}
        {(search || statusFilter || typeFilter || categoryFilter || startDate || endDate) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">Active filters applied</span>
            <button
              onClick={handleClearFilters}
              className="text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Expense Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <th className="py-3 px-4">Expense #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Claimant / Supplier</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-600 mb-2" />
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <Receipt className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No expenses found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting your search criteria or create a new expense.
                    </p>
                    <Link
                      href="/expenses/new"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create Expense
                    </Link>
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-indigo-600">
                      <Link href={`/expenses/${expense.id}`} className="hover:underline">
                        {expense.expenseNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {formatDate(expense.expenseDate)}
                    </td>
                    <td className="py-3 px-4">
                      {expense.expenseType === "EMPLOYEE_CLAIM" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                          Employee Claim
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          Direct Business
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium max-w-[200px] truncate" title={expense.description}>
                      {expense.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {expense.claimant ? (
                        <span className="font-medium text-slate-900">{expense.claimant.name}</span>
                      ) : expense.supplier ? (
                        <span>{expense.supplier.displayName}</span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {expense.category ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {expense.category.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">Multiple</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900 font-mono">
                      {formatCurrency(Number(expense.total))}
                    </td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(expense.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/expenses/${expense.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs">
          <span className="text-slate-500">
            Showing <strong className="text-slate-900">{expenses.length}</strong> of{" "}
            <strong className="text-slate-900">{totalCount}</strong> expenses
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSkip(Math.max(0, skip - take))}
              disabled={skip === 0 || loading}
              className="p-1.5 rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-slate-600 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setSkip(skip + take)}
              disabled={skip + take >= totalCount || loading}
              className="p-1.5 rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
