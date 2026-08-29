import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import {
  FileUp,
  Pill,
  Package,
  Users,
  AlertTriangle,
  DollarSign,
  ShieldCheck,
  Tag,
  BarChart3,
  Sliders,
  CheckCircle,
  Clock,
} from "lucide-react";

export const revalidate = 0;

export default async function AdminDashboardPage() {
  const session = await getSession();

  // Metrics
  const totalOrders = await prisma.order.count();
  const totalRevenueResult = await prisma.order.aggregate({
    _sum: { totalAmount: true },
  });
  const totalRevenue = totalRevenueResult._sum.totalAmount || 0;

  const pendingPrescriptions = await prisma.prescription.count({
    where: { status: "PENDING_REVIEW" },
  });

  const lowStockProducts = await prisma.product.count({
    where: { stockQuantity: { lte: 10 } },
  });

  const totalCustomers = await prisma.user.count({
    where: { role: "CUSTOMER" },
  });

  const recentOrders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });

  const pendingRxList = await prisma.prescription.findMany({
    take: 5,
    where: { status: "PENDING_REVIEW" },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-teal-100 text-teal-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Pharmacy Administration & Pharmacist Review Desk</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Admin & Pharmacist Console</h1>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <Link
              href="/admin/prescriptions"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-sm transition flex items-center space-x-1.5"
            >
              <Pill className="w-4 h-4" />
              <span>Pharmacist Review Queue ({pendingPrescriptions})</span>
            </Link>
            <Link
              href="/admin/products"
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-sm transition"
            >
              Manage Products
            </Link>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-slate-800">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Sales</span>
            <span className="text-2xl font-extrabold text-slate-900">${totalRevenue.toFixed(2)}</span>
            <span className="text-[11px] text-emerald-700 font-semibold block">All completed transactions</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Orders</span>
            <span className="text-2xl font-extrabold text-slate-900">{totalOrders}</span>
            <span className="text-[11px] text-slate-500 block">Customer order history</span>
          </div>

          <div className="bg-amber-50/80 p-5 rounded-2xl border border-amber-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">Pending Rx Reviews</span>
            <span className="text-2xl font-extrabold text-amber-900">{pendingPrescriptions}</span>
            <span className="text-[11px] text-amber-800 font-semibold block">Requires pharmacist approval</span>
          </div>

          <div className="bg-red-50/80 p-5 rounded-2xl border border-red-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-red-900 uppercase tracking-wider block">Low Stock Items</span>
            <span className="text-2xl font-extrabold text-red-900">{lowStockProducts}</span>
            <span className="text-[11px] text-red-800 font-semibold block">Under 10 units threshold</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active Customers</span>
            <span className="text-2xl font-extrabold text-slate-900">{totalCustomers}</span>
            <span className="text-[11px] text-slate-500 block">Registered customer accounts</span>
          </div>
        </div>

        {/* Action Navigation Module Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-center text-xs font-bold">
          <Link href="/admin/prescriptions" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 shadow-xs transition space-y-2">
            <Pill className="w-6 h-6 text-amber-600 mx-auto" />
            <span className="block text-slate-900">Rx Review</span>
          </Link>
          <Link href="/admin/orders" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 shadow-xs transition space-y-2">
            <Package className="w-6 h-6 text-teal-600 mx-auto" />
            <span className="block text-slate-900">Orders</span>
          </Link>
          <Link href="/admin/products" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 shadow-xs transition space-y-2">
            <Pill className="w-6 h-6 text-teal-700 mx-auto" />
            <span className="block text-slate-900">Products</span>
          </Link>
          <Link href="/admin/inventory" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 shadow-xs transition space-y-2">
            <AlertTriangle className="w-6 h-6 text-red-600 mx-auto" />
            <span className="block text-slate-900">Inventory</span>
          </Link>
          <Link href="/admin/promotions" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 shadow-xs transition space-y-2">
            <Tag className="w-6 h-6 text-amber-500 mx-auto" />
            <span className="block text-slate-900">Coupons</span>
          </Link>
          <Link href="/admin/support" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 shadow-xs transition space-y-2">
            <Users className="w-6 h-6 text-slate-700 mx-auto" />
            <span className="block text-slate-900">Support Desk</span>
          </Link>
          <Link href="/admin/site-settings" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 shadow-xs transition space-y-2">
            <Sliders className="w-6 h-6 text-teal-800 mx-auto" />
            <span className="block text-slate-900">Hide/Unhide</span>
          </Link>
        </div>

        {/* Dashboard Activity Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pending Pharmacist Reviews */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center">
                <Pill className="w-4 h-4 text-amber-600 mr-2" />
                Pending Pharmacist Verification Queue
              </h2>
              <Link href="/admin/prescriptions" className="text-xs font-bold text-teal-700 hover:underline">
                View Queue →
              </Link>
            </div>

            {pendingRxList.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No prescriptions currently pending verification.</p>
            ) : (
              <div className="space-y-3 text-xs">
                {pendingRxList.map((rx) => (
                  <div key={rx.id} className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">{rx.fileName}</span>
                      <span className="text-slate-500">Patient: {rx.patientName}</span>
                    </div>
                    <Link
                      href={`/admin/prescriptions`}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg"
                    >
                      Review Rx
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center">
                <Package className="w-4 h-4 text-teal-600 mr-2" />
                Recent Pharmacy Orders
              </h2>
              <Link href="/admin/orders" className="text-xs font-bold text-teal-700 hover:underline">
                View Orders →
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No recent orders.</p>
            ) : (
              <div className="space-y-3 text-xs">
                {recentOrders.map((ord) => (
                  <div key={ord.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">{ord.orderNumber}</span>
                      <span className="text-slate-500">{ord.user.name} • ${ord.totalAmount.toFixed(2)}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-teal-100 text-teal-800">
                      {ord.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
