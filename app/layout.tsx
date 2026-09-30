import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AD CARE & MEDS PHARMACY — Management & Accounting Platform",
  description: "Production-grade multi-tenant business management and accounting platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased text-slate-200 bg-[#020617]">{children}</body>
    </html>
  );
}
