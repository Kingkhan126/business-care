"use client";

import { useState } from "react";
import { FileUp, ShieldCheck, CheckCircle2, AlertCircle, FileText, Lock } from "lucide-react";

export function PrescriptionUploader() {
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 10 * 1024 * 1024) {
        setError("File size exceeds 10MB limit.");
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !file) {
      setError("Please fill in patient name and select a prescription file.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("patientName", patientName);
      formData.append("patientAge", patientAge);
      formData.append("notes", notes);
      formData.append("file", file);

      const res = await fetch("/api/prescriptions/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload prescription.");
      }

      setSuccess(`Prescription submitted successfully! Reference ID: ${data.prescriptionId || "RX-UPLOAD-OK"}`);
      setFile(null);
      setPatientName("");
      setPatientAge("");
      setNotes("");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-start space-x-4 pb-6 border-b border-slate-100">
        <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
          <FileUp className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Upload Doctor Prescription</h2>
          <p className="text-xs text-slate-500 mt-1">
            Submit your doctor's written prescription or e-prescription document for licensed pharmacist review and verification.
          </p>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start space-x-3 text-xs text-teal-900">
        <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">Pharmacist Verification Notice</span>
          Our licensed pharmacy staff verifies all prescription uploads against state & federal pharmaceutical regulations before prescription medicines are dispensed.
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5 text-sm">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs space-y-2">
            <div className="flex items-center space-x-2 font-bold text-sm text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Submission Received</span>
            </div>
            <p>{success}</p>
            <a
              href="/account/prescriptions"
              className="inline-block mt-2 font-bold text-teal-700 hover:underline"
            >
              View Prescription Verification History →
            </a>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Patient Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Jane Doe"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Patient Age
            </label>
            <input
              type="number"
              placeholder="e.g. 35"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Upload File Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Prescription File (Image or PDF) *
          </label>
          <div className="border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50 rounded-xl p-6 text-center cursor-pointer transition">
            <input
              type="file"
              accept="image/jpeg,image/png,image/jpg,application/pdf"
              onChange={handleFileChange}
              className="hidden"
              id="prescription-file-input"
            />
            <label htmlFor="prescription-file-input" className="cursor-pointer block">
              <FileText className="w-8 h-8 text-teal-600 mx-auto mb-2" />
              <span className="text-xs font-bold text-slate-800 block">
                {file ? file.name : "Click to choose prescription image or PDF file"}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                Accepted: JPG, PNG, PDF (Max 10MB)
              </span>
            </label>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Additional Doctor / Pharmacist Notes (Optional)
          </label>
          <textarea
            rows={3}
            placeholder="Mention any specific medicine strength, brand preference, or instructions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <Lock className="w-4 h-4" />
          <span>{loading ? "Submitting Prescription..." : "Submit for Pharmacist Verification"}</span>
        </button>
      </form>
    </div>
  );
}
