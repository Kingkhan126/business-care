import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Applications Platform",
  description: "Submit and track your application online.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
