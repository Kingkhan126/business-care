"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { Building2, Save, CheckCircle2 } from "lucide-react";

export default function OrganizationPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    name: "",
    legalName: "",
    taxId: "",
    email: "",
    phone: "",
    website: "",
    currency: "USD",
    timezone: "UTC",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    fiscalYearStart: 1,
  });

  React.useEffect(() => {
    async function loadOrg() {
      try {
        const res = await fetch("/api/organization");
        const data = await res.json();

        if (res.ok && data.success && data.organization) {
          const org = data.organization;
          setForm({
            name: org.name || "",
            legalName: org.legalName || "",
            taxId: org.taxId || "",
            email: org.email || "",
            phone: org.phone || "",
            website: org.website || "",
            currency: org.currency || "USD",
            timezone: org.timezone || "UTC",
            addressLine1: org.addressLine1 || "",
            addressLine2: org.addressLine2 || "",
            city: org.city || "",
            state: org.state || "",
            postalCode: org.postalCode || "",
            country: org.country || "US",
            fiscalYearStart: org.fiscalYearStart || 1,
          });
        }
      } catch {
        setError("Failed to load organization settings");
      } finally {
        setLoading(false);
      }
    }

    loadOrg();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save settings");
      }

      setSuccess("Organization details saved successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Organization Profile
          </h1>
          <p className="text-xs text-slate-500">
            Manage your legal entity, tax settings, default currency, and address details.
          </p>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-indigo-600" />
              General Business Information
            </CardTitle>
            <CardDescription>
              Primary business identity used across future invoicing, purchase orders, and financial statements.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Business Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                label="Legal Name"
                placeholder="e.g. Acme Global Enterprises LLC"
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Tax Identification / EIN"
                placeholder="US-987654321"
                value={form.taxId}
                onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              />
              <Input
                label="Corporate Email"
                type="email"
                placeholder="contact@acme.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                label="Corporate Phone"
                placeholder="+1 (555) 019-2834"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                Financial & Localization Preferences
              </h4>
              <div className="grid gap-4 sm:grid-cols-3">
                <Select
                  label="Default Currency *"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  options={[
                    { label: "USD - US Dollar ($)", value: "USD" },
                    { label: "EUR - Euro (€)", value: "EUR" },
                    { label: "GBP - British Pound (£)", value: "GBP" },
                    { label: "CAD - Canadian Dollar ($)", value: "CAD" },
                    { label: "AUD - Australian Dollar ($)", value: "AUD" },
                  ]}
                />

                <Select
                  label="Timezone *"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  options={[
                    { label: "UTC (Coordinated Universal Time)", value: "UTC" },
                    { label: "America/New_York (Eastern Time)", value: "America/New_York" },
                    { label: "America/Chicago (Central Time)", value: "America/Chicago" },
                    { label: "America/Los_Angeles (Pacific Time)", value: "America/Los_Angeles" },
                    { label: "Europe/London (GMT/BST)", value: "Europe/London" },
                  ]}
                />

                <Select
                  label="Fiscal Year Start Month *"
                  value={String(form.fiscalYearStart)}
                  onChange={(e) => setForm({ ...form, fiscalYearStart: Number(e.target.value) })}
                  options={[
                    { label: "January", value: "1" },
                    { label: "April", value: "4" },
                    { label: "July", value: "7" },
                    { label: "October", value: "10" },
                  ]}
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                Physical / Headquarters Address
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Address Line 1"
                  placeholder="100 Innovation Way"
                  value={form.addressLine1}
                  onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                />
                <Input
                  label="Address Line 2"
                  placeholder="Suite 400"
                  value={form.addressLine2}
                  onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-4 mt-3">
                <Input
                  label="City"
                  placeholder="Austin"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
                <Input
                  label="State / Province"
                  placeholder="TX"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
                <Input
                  label="Postal Code"
                  placeholder="78701"
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                />
                <Input
                  label="Country Code (ISO 2)"
                  placeholder="US"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t border-slate-100 pt-4">
            <Button type="submit" isLoading={saving} className="gap-2">
              <Save className="h-4 w-4" />
              Save Organization Settings
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
