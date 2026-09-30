"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-md border border-slate-200">
            <img
              src="/logo.jpg"
              alt="AD CARE & MEDS PHARMACY"
              className="h-full w-full object-contain rounded-xl"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign in to AD CARE &amp; MEDS PHARMACY
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Industrial Business Management & Accounting Platform
          </p>
        </div>

        <Card className="shadow-lg border-slate-200">
          <CardHeader>
            <CardTitle>Account Sign In</CardTitle>
            <CardDescription>
              Enter your corporate credentials to access your organization.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="error" title="Authentication Error">
                  {error}
                </Alert>
              )}

              <Input
                label="Email Address"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                required
              />
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Sign In
              </Button>
              <p className="text-center text-xs text-slate-500">
                Don&apos;t have an organization account?{" "}
                <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-500">
                  Create Business Organization
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center text-[11px] text-slate-400">
          Industrial Foundation Architecture &bull; Secure Multi-Tenant Framework
        </div>
      </div>
    </div>
  );
}
