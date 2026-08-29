import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import { RotateCw, Pill, Calendar, ShoppingBag, CheckCircle } from "lucide-react";

export const revalidate = 0;

export default async function RefillRemindersPage() {
  const session = await getSession();
  let userId = session?.userId;
  if (!userId) {
    const cust = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
    userId = cust?.id;
  }

  const reminders = await prisma.refillReminder.findMany({
    where: { userId: userId || "" },
    include: { product: true },
    orderBy: { nextRefillDate: "asc" },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Automated Refill Reminders</h1>
          <p className="text-xs text-slate-500 mt-1">Manage scheduled refills for your daily & monthly medications</p>
        </div>

        {reminders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-xs">
            <RotateCw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-800">No Active Refill Schedules</h2>
            <p className="text-xs text-slate-500 mt-1">Set up automated refills on any prescription or OTC product page.</p>
            <Link href="/products" className="inline-block mt-4 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-xs font-bold">
              Browse Medicines →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reminders.map((rem) => (
              <div key={rem.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold shrink-0">
                      <Pill className="w-5 h-5 rotate-45" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{rem.product.name}</h3>
                      <span className="text-xs text-slate-500 font-mono">SKU: {rem.product.sku}</span>
                    </div>
                  </div>

                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                    Active Schedule
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1 text-slate-700">
                  <div className="flex justify-between">
                    <span>Refill Frequency:</span>
                    <strong className="text-slate-900">Every {rem.frequencyDays} Days</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Next Refill Due:</span>
                    <strong className="text-teal-700">{new Date(rem.nextRefillDate).toLocaleDateString()}</strong>
                  </div>
                  {rem.notes && <p className="italic text-slate-500 pt-1">"{rem.notes}"</p>}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Link
                    href={`/products/${rem.product.id}`}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Quick Reorder Now</span>
                  </Link>
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
