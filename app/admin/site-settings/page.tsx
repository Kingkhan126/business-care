"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Eye, EyeOff, ShieldCheck, CheckCircle2, Sliders, Sparkles } from "lucide-react";

export default function AdminSiteSettingsPage() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/site-settings");
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    } catch {}
  };

  const toggleSetting = async (key: string, currentValue: string) => {
    const newValue = currentValue === "true" ? "false" : "true";
    setLoading(true);

    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: newValue }),
      });
      if (res.ok) {
        setSettings((prev) =>
          prev.map((item) => (item.key === key ? { ...item, value: newValue } : item))
        );
      }
    } catch {
      alert("Failed to update setting.");
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
            <span className="text-xs font-bold text-teal-800 bg-teal-100 border border-teal-300 px-2.5 py-0.5 rounded-full">
              Website Visibility & Feature Hiding Controls
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Website Hide / Unhide Manager</h1>
            <p className="text-xs text-slate-500">Toggle sections, hero banners, and promotional areas on the live website with a single click</p>
          </div>
        </div>

        {/* Info */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm flex items-start space-x-4 text-xs">
          <Sliders className="w-8 h-8 text-teal-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-teal-300">Live Website Section Visibility Control</h3>
            <p className="text-slate-300 leading-relaxed">
              When a section or feature is turned OFF, it will be hidden immediately from all website visitors. You can turn it back ON anytime without making code changes.
            </p>
          </div>
        </div>

        {/* Settings Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {settings.map((s) => {
            const isVisible = s.value === "true";
            return (
              <div key={s.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{s.label}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Key: <code className="bg-slate-100 px-1 py-0.5 rounded">{s.key}</code></p>
                  <span className={`text-[11px] font-bold block mt-2 ${isVisible ? "text-emerald-700" : "text-slate-400"}`}>
                    {isVisible ? "● Visible on Website" : "○ Hidden from Website"}
                  </span>
                </div>

                <button
                  onClick={() => toggleSetting(s.key, s.value)}
                  disabled={loading}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition shadow-sm ${
                    isVisible
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                  }`}
                >
                  {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  <span>{isVisible ? "Hide Section" : "Show Section"}</span>
                </button>
              </div>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}
