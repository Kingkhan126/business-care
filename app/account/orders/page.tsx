import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import { Package, Clock, CheckCircle2, AlertCircle, Pill, ChevronRight } from "lucide-react";

export const revalidate = 0;

export default async function CustomerOrdersPage() {
  const session = await getSession();
  let userId = session?.userId;
  if (!userId) {
    const cust = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
    userId = cust?.id;
  }

  const orders = await prisma.order.findMany({
    where: { userId: userId || "" },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      prescription: true,
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Your Order History</h1>
          <p className="text-xs text-slate-500 mt-1">Track pharmacy orders, review items, and manage cancellations</p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-xs">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-800">No Orders Found</h2>
            <p className="text-xs text-slate-500 mt-1">You haven't placed any pharmacy orders yet.</p>
            <Link
              href="/products"
              className="inline-block mt-4 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition"
            >
              Shop Pharmacy Catalog →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-sm text-slate-900">{order.orderNumber}</span>
                      <span className="text-xs text-slate-400">• {new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <span className="text-xs text-slate-500">Payment: {order.paymentMethod} ({order.paymentStatus})</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        order.status === "DELIVERED"
                          ? "bg-emerald-100 text-emerald-800"
                          : order.status === "PRESCRIPTION_VERIFICATION"
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : order.status === "CANCELLED"
                          ? "bg-red-100 text-red-800"
                          : "bg-teal-100 text-teal-800"
                      }`}
                    >
                      {order.status.replace("_", " ")}
                    </span>
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="text-xs font-bold text-teal-700 hover:underline flex items-center"
                    >
                      View Details <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="space-y-2 text-xs">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-slate-700">
                      <span className="flex items-center font-medium">
                        {item.isPrescriptionRequired && <Pill className="w-3 h-3 mr-1 text-amber-600 shrink-0" />}
                        {item.quantity}x {item.productName}
                      </span>
                      <span className="font-bold text-slate-900">${item.totalPrice.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-500">
                    Est. Delivery: <strong className="text-slate-800">{order.estimatedDelivery || "Processing"}</strong>
                  </span>
                  <span className="text-sm font-extrabold text-slate-900">
                    Total: ${order.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
