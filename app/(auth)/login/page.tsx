"use client";

import { useState } from "react";
import Link from "next/link";
import { Pill, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed.");
      }
      window.location.href = data.role === "ADMIN" || data.role === "PHARMACIST" ? "/admin" : "/";
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center space-x-3">
            <div className="w-10 h-10 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <path d="M 18,38 H 38 V 18 H 50 V 82 H 38 V 62 H 18 Z" fill="#62B834" />
                <path d="M 50,18 H 62 V 38 H 82 V 62 H 62 V 82 H 50 Z" fill="#3B5488" />
                <circle cx="50" cy="50" r="15" fill="white" />
                <path d="M 43,50 H 57 M 50,43 V 57" stroke="#3B5488" strokeWidth="4.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col text-left">
              <div className="text-xl font-extrabold tracking-tight leading-none flex items-center">
                <span className="text-[#3B5488]">AD&nbsp;</span>
                <span className="text-[#62B834]">CARE</span>
              </div>
              <span className="text-[11px] font-bold text-[#3B5488] tracking-tight block mt-0.5">
                Meds & Pharmacy
              </span>
            </div>
          </Link>
          <h1 className="text-lg font-bold text-slate-900 pt-2">Customer & Staff Portal Login</h1>
          <p className="text-xs text-slate-500">Sign in to your pharmacy account or administration console</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="customer@pharmacy.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-xs disabled:opacity-50"
          >
            <span>{loading ? "Signing in..." : "Sign In to Account"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
          <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">1-Click Quick Demo Sign In:</span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setEmail("admin@pharmacy.com");
                setPassword("Pharmacy123!");
              }}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-lg shadow-xs transition text-center"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("pharmacist@pharmacy.com");
                setPassword("Pharmacy123!");
              }}
              className="px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-[11px] rounded-lg shadow-xs transition text-center"
            >
              Pharmacist
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("customer@pharmacy.com");
                setPassword("Pharmacy123!");
              }}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-xs transition text-center"
            >
              Customer
            </button>
          </div>
          <div className="text-[10px] text-slate-500 pt-1">
            Click any button above to auto-fill credentials, then click <strong>Sign In</strong>.
          </div>
        </div>

        <div className="text-center text-xs text-slate-500">
          Don't have an account?{" "}
          <Link href="/register" className="font-bold text-teal-700 hover:underline">
            Register New Account
          </Link>
        </div>
      </div>
    </div>
  );
}
