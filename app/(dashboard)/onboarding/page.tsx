"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Building2, MapPin, Globe, CreditCard, Users, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form State
  const [name, setName] = React.useState("Acme Global Enterprises");
  const [legalName, setLegalName] = React.useState("Acme Global Enterprises LLC");
  const [description, setDescription] = React.useState("Global manufacturing and logistics provider");
  const [registrationNumber, setRegistrationNumber] = React.useState("CRN-98765432");
  const [taxId, setTaxId] = React.useState("US-987654321");
  const [email, setEmail] = React.useState("contact@acmeglobal.com");
  const [phone, setPhone] = React.useState("+1 (555) 019-2834");

  const [addressLine1, setAddressLine1] = React.useState("100 Innovation Way");
  const [addressLine2, setAddressLine2] = React.useState("Suite 400");
  const [city, setCity] = React.useState("Austin");
  const [state, setState] = React.useState("TX");
  const [postalCode, setPostalCode] = React.useState("78701");
  const [country, setCountry] = React.useState("US");

  const [currency, setCurrency] = React.useState("USD");
  const [timezone, setTimezone] = React.useState("America/New_York");
  const [dateFormat, setDateFormat] = React.useState("YYYY-MM-DD");
  const [numberFormat, setNumberFormat] = React.useState("comma_dot");

  const [fiscalYearStart, setFiscalYearStart] = React.useState(1);
  const [invoicePrefix, setInvoicePrefix] = React.useState("INV-");
  const [estimatePrefix, setEstimatePrefix] = React.useState("EST-");

  const handleNext = async () => {
    setError(null);
    setLoading(true);

    try {
      if (step === 1) {
        await fetch("/api/organization/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, legalName, description, registrationNumber, taxId, email, phone, country }),
        });
      } else if (step === 2) {
        await fetch("/api/organization/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, addressLine1, addressLine2, city, state, postalCode, country }),
        });
      } else if (step === 3 || step === 4) {
        await fetch("/api/organization/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dateFormat,
            timeFormat: "24h",
            numberFormat,
            currency,
            timezone,
            fiscalYearStart,
            taxInclusivePricing: false,
            defaultTaxRate: 0,
            invoicePrefix,
            estimatePrefix,
            purchaseOrderPrefix: "PO-",
            billPrefix: "BILL-",
            nextInvoiceNumber: 1001,
            nextEstimateNumber: 1001,
            nextPurchaseOrderNumber: 1001,
          }),
        });
      }

      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: step + 1 }),
      });

      if (step < 6) {
        setStep(step + 1);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save step");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      {/* Onboarding Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-xl shadow-md">
          B
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Set Up Your Business Organization
        </h1>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Guided 6-step setup for corporate identity, localization, and team permissions.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(step / 6) * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] font-mono text-slate-500">
        <span>Step {step} of 6</span>
        <span>{Math.round((step / 6) * 100)}% Completed</span>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card className="shadow-lg border-slate-200">
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-5 w-5 text-indigo-600" />
                1. Business Identity
              </CardTitle>
              <CardDescription>
                Primary business name, legal entity, and contact channels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input label="Business Name *" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input label="Legal Entity Name" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
              <Input label="Company Registration Number (CRN)" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Corporate Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input label="Corporate Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </CardContent>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5 text-indigo-600" />
                2. Headquarters Address
              </CardTitle>
              <CardDescription>
                Physical address used for invoicing, purchase orders, and legal headers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input label="Address Line 1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
              <Input label="Address Line 2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
                <Input label="State / Province" value={state} onChange={(e) => setState(e.target.value)} />
                <Input label="Postal Code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </div>
            </CardContent>
          </>
        )}

        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-5 w-5 text-indigo-600" />
                3. Localization & Currency
              </CardTitle>
              <CardDescription>
                Configure default operating currency and organization timezone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Operating Currency *"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                options={[
                  { label: "USD - US Dollar ($)", value: "USD" },
                  { label: "EUR - Euro (€)", value: "EUR" },
                  { label: "GBP - British Pound (£)", value: "GBP" },
                  { label: "PKR - Pakistani Rupee (Rs)", value: "PKR" },
                  { label: "CAD - Canadian Dollar (CA$)", value: "CAD" },
                ]}
              />
              <Select
                label="Organization Timezone *"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                options={[
                  { label: "America/New_York (Eastern Time)", value: "America/New_York" },
                  { label: "America/Chicago (Central Time)", value: "America/Chicago" },
                  { label: "America/Los_Angeles (Pacific Time)", value: "America/Los_Angeles" },
                  { label: "Europe/London (GMT/BST)", value: "Europe/London" },
                  { label: "Asia/Karachi (PKT)", value: "Asia/Karachi" },
                ]}
              />
            </CardContent>
          </>
        )}

        {step === 4 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-5 w-5 text-indigo-600" />
                4. Financial Year & Document Prefixes
              </CardTitle>
              <CardDescription>
                Fiscal year start month and commercial document prefixes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Fiscal Year Start Month *"
                value={String(fiscalYearStart)}
                onChange={(e) => setFiscalYearStart(Number(e.target.value))}
                options={[
                  { label: "January", value: "1" },
                  { label: "April", value: "4" },
                  { label: "July", value: "7" },
                  { label: "October", value: "10" },
                ]}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Invoice Prefix" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} />
                <Input label="Estimate Prefix" value={estimatePrefix} onChange={(e) => setEstimatePrefix(e.target.value)} />
              </div>
            </CardContent>
          </>
        )}

        {step === 5 && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-indigo-600" />
                5. Team & Initial Access
              </CardTitle>
              <CardDescription>
                You can invite team members now or skip to complete setup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="info" title="Invitation Ready">
                Team invitations and custom RBAC permissions can be configured anytime under Settings &bull; Team.
              </Alert>
            </CardContent>
          </>
        )}

        {step === 6 && (
          <>
            <CardHeader className="text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
              <CardTitle className="text-xl mt-2">Setup Completed!</CardTitle>
              <CardDescription>
                Your business organization setup is finished and fully configured.
              </CardDescription>
            </CardHeader>
          </>
        )}

        <CardFooter className="flex items-center justify-between border-t border-slate-100 pt-4">
          {step > 1 && step < 6 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <div />
          )}

          <Button onClick={handleNext} isLoading={loading} className="gap-2">
            {step === 6 ? "Go to Dashboard" : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
