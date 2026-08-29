import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { prisma } from "@/lib/db/prisma";
import { BarChart3, FileText, ShieldCheck } from "lucide-react";

export const revalidate = 0;

export default async function AdminReportsPage() {
  const auditLogs = await prisma.prescriptionAuditLog.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      prescription: true,
      actor: { select: { name: true, role: true } },
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Pharmacy Reports & Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-1">Prescription verification logs, regulatory compliance history, and sales summary</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center border-b border-slate-100 pb-3">
            <ShieldCheck className="w-5 h-5 text-teal-600 mr-2" />
            Prescription Verification Audit Log
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-slate-200 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Prescription File</th>
                  <th className="p-3">Actor / Reviewer</th>
                  <th className="p-3">Status Transition</th>
                  <th className="p-3">Pharmacist Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono text-[10px] text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {log.prescription.fileName}
                    </td>
                    <td className="p-3">
                      {log.actor.name} ({log.actor.role})
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-teal-800">{log.oldStatus || "INITIAL"} → {log.newStatus}</span>
                    </td>
                    <td className="p-3 italic text-slate-600">
                      {log.notes || "No notes"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
