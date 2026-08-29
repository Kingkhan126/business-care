"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ShieldCheck, Pill, CheckCircle2, XCircle, AlertCircle, FileText, Lock } from "lucide-react";

export default function PharmacistPrescriptionsReviewPage() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [filter, setFilter] = useState("PENDING_REVIEW");
  const [selectedRx, setSelectedRx] = useState<any | null>(null);
  const [pharmacistNotes, setPharmacistNotes] = useState("");
  const [actionStatus, setActionStatus] = useState("APPROVED");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const fetchPrescriptions = async () => {
    try {
      const res = await fetch("/api/categories"); // quick test or build dedicated endpoint
      // Fetch via direct DB API or client list
    } catch {}
  };

  const handleUpdateStatus = async (rxId: string, newStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/prescriptions/${rxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          pharmacistNotes,
        }),
      });
      if (res.ok) {
        alert(`Prescription status updated to ${newStatus}`);
        setSelectedRx(null);
        setPharmacistNotes("");
        window.location.reload();
      }
    } catch {
      alert("Failed to update status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-4">
          <div>
            <span className="text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
              Licensed Pharmacist Console
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Pharmacist Prescription Review Workspace</h1>
            <p className="text-xs text-slate-500">Verify physician prescriptions, validate dosage, and manage approval status</p>
          </div>
        </div>

        {/* Informational Guidance */}
        <div className="bg-teal-900 text-white p-6 rounded-2xl shadow-sm flex items-start space-x-4 text-xs">
          <ShieldCheck className="w-8 h-8 text-teal-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-teal-200">Pharmacist Verification Protocol</h3>
            <p className="text-slate-300 leading-relaxed">
              Inspect the patient's uploaded doctor prescription for physician signature, date, dosage instructions, and refill validity. Approved prescriptions automatically unlock prescription-restricted items in the customer's cart.
            </p>
          </div>
        </div>

        {/* Demo Pharmacist Verification Queue Display */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            Active Pharmacist Verification Queue
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* List */}
            <div className="lg:col-span-6 space-y-3 text-xs">
              <div
                onClick={() => {
                  setSelectedRx({
                    id: "demo-rx-1",
                    patientName: "John Doe",
                    patientAge: 45,
                    fileName: "John_Doe_Prescription_Aug2026.pdf",
                    status: "PENDING_REVIEW",
                    notes: "Prescription for Amoxicillin 500mg (21 caps)",
                    date: "Aug 29, 2026",
                  });
                }}
                className="p-4 bg-amber-50/80 rounded-xl border border-amber-200 cursor-pointer hover:border-teal-500 transition space-y-1"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">John_Doe_Prescription_Aug2026.pdf</span>
                  <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-bold rounded uppercase text-[10px]">
                    PENDING REVIEW
                  </span>
                </div>
                <p className="text-slate-600">Patient: John Doe (45 yrs)</p>
                <span className="text-slate-400 block text-[10px]">Uploaded Aug 29, 2026</span>
              </div>
            </div>

            {/* Verification Tool Console */}
            <div className="lg:col-span-6 bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">
                Pharmacist Review & Decision Panel
              </h3>

              {selectedRx ? (
                <div className="space-y-4">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <span className="font-bold block text-slate-900">{selectedRx.fileName}</span>
                    <p className="text-slate-600">Patient Name: {selectedRx.patientName}</p>
                    <p className="text-slate-600">Patient Age: {selectedRx.patientAge} years</p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Pharmacist Clinical & Verification Notes
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Enter verification rationale, dosage confirmation, or reason for rejection/clarification..."
                      value={pharmacistNotes}
                      onChange={(e) => setPharmacistNotes(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleUpdateStatus(selectedRx.id, "APPROVED")}
                      disabled={loading}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition text-xs shadow-xs"
                    >
                      Approve Rx
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedRx.id, "CLARIFICATION_REQUESTED")}
                      disabled={loading}
                      className="py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg transition text-xs shadow-xs"
                    >
                      Request Info
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedRx.id, "REJECTED")}
                      disabled={loading}
                      className="py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition text-xs shadow-xs"
                    >
                      Reject Rx
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 italic">Select a prescription from the queue on the left to verify.</p>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
