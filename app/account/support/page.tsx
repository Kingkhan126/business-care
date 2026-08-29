import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { MessageSquare, PhoneCall, Mail, CheckCircle2, Clock } from "lucide-react";

export const revalidate = 0;

export default async function CustomerSupportPage() {
  const session = await getSession();
  let userId = session?.userId;
  if (!userId) {
    const cust = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
    userId = cust?.id;
  }

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: userId || "" },
    orderBy: { createdAt: "desc" },
    include: {
      order: { select: { orderNumber: true } },
      messages: { include: { sender: { select: { name: true, role: true } } } },
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Pharmacy Customer Support</h1>
          <p className="text-xs text-slate-500 mt-1">Get assistance with orders, prescription verification, or general questions</p>
        </div>

        {/* Contact info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 block">Phone Support</span>
              <span className="text-slate-500">1-800-555-MEDS (Mon-Sat)</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 block">Email Support</span>
              <span className="text-slate-500">support@medicarerx-pharmacy.com</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 block">Ticket Response Time</span>
              <span className="text-slate-500">Under 2 hours during pharmacy hours</span>
            </div>
          </div>
        </div>

        {/* Support Tickets */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Your Support Desk Tickets</h2>

          {tickets.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No support tickets created yet.</p>
          ) : (
            <div className="space-y-4">
              {tickets.map((t) => (
                <div key={t.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <span className="font-mono font-bold text-teal-700">{t.ticketNumber}</span>
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5">{t.subject}</h3>
                      {t.order && <span className="text-[11px] text-slate-500">Linked Order: {t.order.orderNumber}</span>}
                    </div>
                    <span className="bg-teal-100 text-teal-800 px-2.5 py-1 rounded-full font-bold uppercase text-[10px]">
                      {t.status}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {t.messages.map((m) => (
                      <div key={m.id} className={`p-3 rounded-lg ${m.sender.role === "CUSTOMER" ? "bg-white border border-slate-200" : "bg-teal-50 border border-teal-100"}`}>
                        <div className="flex justify-between font-bold text-slate-800 mb-1">
                          <span>{m.sender.name} ({m.sender.role})</span>
                          <span className="text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-700">{m.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
