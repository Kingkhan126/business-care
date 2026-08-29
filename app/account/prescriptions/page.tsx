import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import { FileUp, ShieldCheck, CheckCircle2, Clock, AlertCircle, FileText } from "lucide-react";

export const revalidate = 0;

export default async function PrescriptionsHistoryPage() {
  const session = await getSession();
  let userId = session?.userId;
  if (!userId) {
    const cust = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
    userId = cust?.id;
  }

  const prescriptions = await prisma.prescription.findMany({
    where: { userId: userId || "" },
    orderBy: { createdAt: "desc" },
    include: {
      reviewedBy: { select: { name: true } },
      auditLogs: { orderBy: { createdAt: "asc" } },
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Prescription Verification History</h1>
            <p className="text-xs text-slate-500 mt-1">Track pharmacist reviews for your uploaded doctor prescriptions</p>
          </div>

          <Link
            href="/prescriptions/upload"
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-2 shrink-0"
          >
            <FileUp className="w-4 h-4" />
            <span>Upload New Prescription</span>
          </Link>
        </div>

        {prescriptions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-xs">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-800">No Prescriptions Uploaded</h2>
            <p className="text-xs text-slate-500 mt-1">Submit your physician's prescription to order Rx medications.</p>
            <Link
              href="/prescriptions/upload"
              className="inline-block mt-4 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-xs font-bold"
            >
              Upload Prescription Now →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {prescriptions.map((rx) => (
              <div key={rx.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{rx.fileName}</h3>
                      <p className="text-xs text-slate-500">
                        Patient: <strong>{rx.patientName}</strong> {rx.patientAge ? `(${rx.patientAge} yrs)` : ""} • Uploaded {new Date(rx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        rx.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : rx.status === "REJECTED"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-900 border border-amber-300"
                      }`}
                    >
                      {rx.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {rx.pharmacistNotes && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
                    <span className="font-bold text-slate-900 block mb-0.5">Pharmacist Review Notes:</span>
                    <p className="italic">"{rx.pharmacistNotes}"</p>
                    {rx.reviewedBy && (
                      <span className="text-[11px] text-slate-400 block mt-1">Reviewed by {rx.reviewedBy.name}</span>
                    )}
                  </div>
                )}

                {/* Audit Logs */}
                {rx.auditLogs.length > 0 && (
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span className="font-bold text-slate-700 block mb-1">Verification History Trail:</span>
                    <ul className="space-y-1 pl-4 list-disc">
                      {rx.auditLogs.map((log) => (
                        <li key={log.id}>
                          Status updated to <strong>{log.newStatus}</strong> ({new Date(log.createdAt).toLocaleString()})
                          {log.notes ? ` - ${log.notes}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
