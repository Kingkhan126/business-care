"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Dialog } from "@/components/ui/Dialog";
import {
  Building2,
  Globe,
  CreditCard,
  Users,
  Shield,
  Upload,
  Trash2,
  Plus,
  Save,
  Check,
  Mail,
  UserCheck,
  XCircle,
  Clock,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";

export default function SettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Profile Form
  const [profile, setProfile] = React.useState({
    name: "",
    legalName: "",
    description: "",
    registrationNumber: "",
    taxId: "",
    email: "",
    phone: "",
    website: "",
    logoUrl: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });

  // Settings Form
  const [settings, setSettings] = React.useState({
    dateFormat: "YYYY-MM-DD",
    timeFormat: "24h",
    numberFormat: "comma_dot",
    currency: "USD",
    timezone: "UTC",
    fiscalYearStart: 1,
    taxInclusivePricing: false,
    taxRegistrationNumber: "",
    defaultTaxRate: 0,
    invoicePrefix: "INV-",
    estimatePrefix: "EST-",
    purchaseOrderPrefix: "PO-",
    billPrefix: "BILL-",
    nextInvoiceNumber: 1001,
    nextEstimateNumber: 1001,
    nextPurchaseOrderNumber: 1001,
  });

  // Team & Roles State
  const [members, setMembers] = React.useState<any[]>([]);
  const [invitations, setInvitations] = React.useState<any[]>([]);
  const [roles, setRoles] = React.useState<any[]>([]);
  const [permissions, setPermissions] = React.useState<any[]>([]);

  // Dialog Modals State
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRoleId, setInviteRoleId] = React.useState("");

  const [isCustomRoleOpen, setIsCustomRoleOpen] = React.useState(false);
  const [customRoleName, setCustomRoleName] = React.useState("");
  const [customRoleDesc, setCustomRoleDesc] = React.useState("");
  const [selectedPerms, setSelectedPerms] = React.useState<string[]>([]);

  // Load All Data
  const loadData = React.useCallback(async () => {
    try {
      const [orgRes, settingsRes, membersRes, invRes, rolesRes] = await Promise.all([
        fetch("/api/organization"),
        fetch("/api/organization/settings"),
        fetch("/api/organization/members/list").catch(() => fetch("/api/organization/members")),
        fetch("/api/organization/invitations"),
        fetch("/api/organization/roles"),
      ]);

      const orgData = await orgRes.json();
      const settingsData = await settingsRes.json();
      const invData = await invRes.json();
      const rolesData = await rolesRes.json();

      if (orgData.success && orgData.organization) {
        const o = orgData.organization;
        setProfile({
          name: o.name || "",
          legalName: o.legalName || "",
          description: o.description || "",
          registrationNumber: o.registrationNumber || "",
          taxId: o.taxId || "",
          email: o.email || "",
          phone: o.phone || "",
          website: o.website || "",
          logoUrl: o.logoUrl || "",
          addressLine1: o.addressLine1 || "",
          addressLine2: o.addressLine2 || "",
          city: o.city || "",
          state: o.state || "",
          postalCode: o.postalCode || "",
          country: o.country || "US",
        });

        if (o.members) setMembers(o.members);
      }

      if (settingsData.success && settingsData.settings) {
        const s = settingsData.settings;
        setSettings({
          dateFormat: s.dateFormat || "YYYY-MM-DD",
          timeFormat: s.timeFormat || "24h",
          numberFormat: s.numberFormat || "comma_dot",
          currency: s.currency || "USD",
          timezone: s.timezone || "UTC",
          fiscalYearStart: s.fiscalYearStart || 1,
          taxInclusivePricing: Boolean(s.taxInclusivePricing),
          taxRegistrationNumber: s.taxRegistrationNumber || "",
          defaultTaxRate: s.defaultTaxRate || 0,
          invoicePrefix: s.invoicePrefix || "INV-",
          estimatePrefix: s.estimatePrefix || "EST-",
          purchaseOrderPrefix: s.purchaseOrderPrefix || "PO-",
          billPrefix: s.billPrefix || "BILL-",
          nextInvoiceNumber: s.nextInvoiceNumber || 1001,
          nextEstimateNumber: s.nextEstimateNumber || 1001,
          nextPurchaseOrderNumber: s.nextPurchaseOrderNumber || 1001,
        });
      }

      if (invData.success) setInvitations(invData.invitations || []);
      if (rolesData.success) {
        setRoles(rolesData.roles || []);
        setPermissions(rolesData.permissions || []);
        if (rolesData.roles && rolesData.roles.length > 0) {
          setInviteRoleId(rolesData.roles[0].id);
        }
      }
    } catch {
      setError("Failed to load organization settings");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/organization/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to update profile");

      setSuccess("Organization profile updated successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // Settings Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/organization/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to update settings");

      setSuccess("Regional and financial settings saved successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  // Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/organization/logo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to upload logo");

      setProfile({ ...profile, logoUrl: data.logoUrl });
      setSuccess("Organization logo updated successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setSaving(false);
    }
  };

  // Remove Logo
  const handleRemoveLogo = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/organization/logo", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to remove logo");

      setProfile({ ...profile, logoUrl: "" });
      setSuccess("Organization logo removed.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove logo");
    } finally {
      setSaving(false);
    }
  };

  // Invite Team Member
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/organization/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, roleId: inviteRoleId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to send invitation");

      setSuccess("Invitation created successfully (Email delivery pending/not configured in dev mode).");
      setIsInviteOpen(false);
      setInviteEmail("");
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setSaving(false);
    }
  };

  // Revoke Invitation
  const handleRevokeInvite = async (invId: string) => {
    try {
      const res = await fetch(`/api/organization/invitations/${invId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess("Invitation revoked.");
        loadData();
      }
    } catch {
      setError("Failed to revoke invitation");
    }
  };

  // Member Status Toggle with Owner Safeguard
  const handleToggleMemberStatus = async (memberId: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setError(null);

    try {
      const res = await fetch(`/api/organization/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to update member status");

      setSuccess(`Member status updated to ${newStatus}.`);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  // Create Custom Role
  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/organization/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customRoleName,
          description: customRoleDesc,
          permissionCodes: selectedPerms,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to create custom role");

      setSuccess(`Custom role '${customRoleName}' created successfully.`);
      setIsCustomRoleOpen(false);
      setCustomRoleName("");
      setCustomRoleDesc("");
      setSelectedPerms([]);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create custom role");
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
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Organization Settings & Management
        </h1>
        <p className="text-xs text-slate-500">
          Configure corporate profile, logo, regional formats, tax preferences, team members, and custom RBAC permissions.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Tabs defaultValue="profile">
        <TabList>
          <TabTrigger value="profile">Profile & Branding</TabTrigger>
          <TabTrigger value="regional">Regional & Formats</TabTrigger>
          <TabTrigger value="financial">Financial & Tax</TabTrigger>
          <TabTrigger value="team">Team & Members</TabTrigger>
          <TabTrigger value="roles">Roles & Permissions</TabTrigger>
        </TabList>

        {/* Tab 1: Profile & Branding */}
        <TabContent value="profile">
          <form onSubmit={handleSaveProfile}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  Organization Profile & Branding
                </CardTitle>
                <CardDescription>
                  Business identity, corporate description, tax IDs, and logo artwork.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Uploader */}
                <div className="flex items-center gap-6 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white shadow-xs overflow-hidden">
                    {profile.logoUrl ? (
                      <Image
                        src={profile.logoUrl}
                        alt="Organization Logo"
                        fill
                        className="object-contain p-1"
                      />
                    ) : (
                      <Building2 className="h-8 w-8 text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-900">Organization Logo</h4>
                    <p className="text-[11px] text-slate-500">
                      PNG, JPEG, WEBP or SVG (Max file size: 2MB). Magic byte verified.
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-white border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors">
                        <Upload className="h-3.5 w-3.5 text-slate-500" />
                        Upload Logo
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                      {profile.logoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveLogo}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Business Name *"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    required
                  />
                  <Input
                    label="Legal Entity Name"
                    placeholder="Acme Global Enterprises LLC"
                    value={profile.legalName}
                    onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    label="Company Registration Number (CRN)"
                    placeholder="CRN-98765432"
                    value={profile.registrationNumber}
                    onChange={(e) => setProfile({ ...profile, registrationNumber: e.target.value })}
                  />
                  <Input
                    label="Tax Identification / EIN"
                    placeholder="US-987654321"
                    value={profile.taxId}
                    onChange={(e) => setProfile({ ...profile, taxId: e.target.value })}
                  />
                  <Input
                    label="Corporate Website"
                    placeholder="https://acmeglobal.com"
                    value={profile.website}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Corporate Email"
                    type="email"
                    placeholder="contact@acmeglobal.com"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  />
                  <Input
                    label="Corporate Phone"
                    placeholder="+1 (555) 019-2834"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Headquarters Address
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Address Line 1"
                      placeholder="100 Innovation Way"
                      value={profile.addressLine1}
                      onChange={(e) => setProfile({ ...profile, addressLine1: e.target.value })}
                    />
                    <Input
                      label="Address Line 2"
                      placeholder="Suite 400"
                      value={profile.addressLine2}
                      onChange={(e) => setProfile({ ...profile, addressLine2: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-4">
                    <Input
                      label="City"
                      placeholder="Austin"
                      value={profile.city}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    />
                    <Input
                      label="State / Province"
                      placeholder="TX"
                      value={profile.state}
                      onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                    />
                    <Input
                      label="Postal Code"
                      placeholder="78701"
                      value={profile.postalCode}
                      onChange={(e) => setProfile({ ...profile, postalCode: e.target.value })}
                    />
                    <Input
                      label="Country Code (ISO 2)"
                      placeholder="US"
                      value={profile.country}
                      onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t border-slate-100 pt-4">
                <Button type="submit" isLoading={saving} className="gap-2">
                  <Save className="h-4 w-4" /> Save Profile
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabContent>

        {/* Tab 2: Regional & Formats */}
        <TabContent value="regional">
          <form onSubmit={handleSaveSettings}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-5 w-5 text-indigo-600" />
                  Regional & Localization Settings
                </CardTitle>
                <CardDescription>
                  Currency representation, IANA timezone identifiers, and document formatting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Operating Currency *"
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    options={[
                      { label: "USD - US Dollar ($)", value: "USD" },
                      { label: "EUR - Euro (€)", value: "EUR" },
                      { label: "GBP - British Pound (£)", value: "GBP" },
                      { label: "PKR - Pakistani Rupee (Rs)", value: "PKR" },
                      { label: "CAD - Canadian Dollar (CA$)", value: "CAD" },
                      { label: "AUD - Australian Dollar (A$)", value: "AUD" },
                      { label: "INR - Indian Rupee (₹)", value: "INR" },
                      { label: "JPY - Japanese Yen (¥)", value: "JPY" },
                      { label: "AED - UAE Dirham (AED)", value: "AED" },
                      { label: "SAR - Saudi Riyal (SAR)", value: "SAR" },
                    ]}
                  />

                  <Select
                    label="Organization Timezone *"
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    options={[
                      { label: "UTC (Coordinated Universal Time)", value: "UTC" },
                      { label: "America/New_York (Eastern Time)", value: "America/New_York" },
                      { label: "America/Chicago (Central Time)", value: "America/Chicago" },
                      { label: "America/Los_Angeles (Pacific Time)", value: "America/Los_Angeles" },
                      { label: "Europe/London (GMT/BST)", value: "Europe/London" },
                      { label: "Asia/Karachi (PKT)", value: "Asia/Karachi" },
                    ]}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Date Format *"
                    value={settings.dateFormat}
                    onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
                    options={[
                      { label: "YYYY-MM-DD (2026-09-25)", value: "YYYY-MM-DD" },
                      { label: "MM/DD/YYYY (09/25/2026)", value: "MM/DD/YYYY" },
                      { label: "DD/MM/YYYY (25/09/2026)", value: "DD/MM/YYYY" },
                    ]}
                  />

                  <Select
                    label="Number Format *"
                    value={settings.numberFormat}
                    onChange={(e) => setSettings({ ...settings, numberFormat: e.target.value })}
                    options={[
                      { label: "1,234.56 (Comma thousands, dot decimal)", value: "comma_dot" },
                      { label: "1.234,56 (Dot thousands, comma decimal)", value: "dot_comma" },
                      { label: "1 234.56 (Space thousands, dot decimal)", value: "space_dot" },
                    ]}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t border-slate-100 pt-4">
                <Button type="submit" isLoading={saving} className="gap-2">
                  <Save className="h-4 w-4" /> Save Regional Settings
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabContent>

        {/* Tab 3: Financial & Tax Settings */}
        <TabContent value="financial">
          <form onSubmit={handleSaveSettings}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-5 w-5 text-indigo-600" />
                  Financial & Document Numbering Foundation
                </CardTitle>
                <CardDescription>
                  Fiscal year start, tax configuration defaults, and commercial document prefixes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Select
                    label="Fiscal Year Start Month *"
                    value={String(settings.fiscalYearStart)}
                    onChange={(e) => setSettings({ ...settings, fiscalYearStart: Number(e.target.value) })}
                    options={[
                      { label: "January", value: "1" },
                      { label: "April", value: "4" },
                      { label: "July", value: "7" },
                      { label: "October", value: "10" },
                    ]}
                  />

                  <Input
                    label="Tax Registration Number"
                    placeholder="VAT-99887766"
                    value={settings.taxRegistrationNumber}
                    onChange={(e) => setSettings({ ...settings, taxRegistrationNumber: e.target.value })}
                  />

                  <Input
                    label="Default Tax Rate (%)"
                    type="number"
                    step="0.01"
                    value={settings.defaultTaxRate}
                    onChange={(e) => setSettings({ ...settings, defaultTaxRate: Number(e.target.value) })}
                  />
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Commercial Document Prefixes & Sequences
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Invoice Prefix"
                      value={settings.invoicePrefix}
                      onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
                    />
                    <Input
                      label="Next Invoice Number"
                      type="number"
                      value={settings.nextInvoiceNumber}
                      onChange={(e) => setSettings({ ...settings, nextInvoiceNumber: Number(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Estimate Prefix"
                      value={settings.estimatePrefix}
                      onChange={(e) => setSettings({ ...settings, estimatePrefix: e.target.value })}
                    />
                    <Input
                      label="Next Estimate Number"
                      type="number"
                      value={settings.nextEstimateNumber}
                      onChange={(e) => setSettings({ ...settings, nextEstimateNumber: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t border-slate-100 pt-4">
                <Button type="submit" isLoading={saving} className="gap-2">
                  <Save className="h-4 w-4" /> Save Financial Preferences
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabContent>

        {/* Tab 4: Team & Members */}
        <TabContent value="team">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Organization Members</h3>
                <p className="text-xs text-slate-500">Manage active team access and pending invitations.</p>
              </div>
              <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Invite Team Member
              </Button>
            </div>

            <Alert variant="info" title="Final Owner Protection Active">
              Server validation prevents removing or deactivating the final active Owner of the organization.
            </Alert>

            {/* Active Members Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Active & Suspended Members ({members.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="font-semibold text-slate-900">{m.user.name}</div>
                          <div className="text-xs text-slate-500">{m.user.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.role.name}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.status === "ACTIVE" ? "success" : "error"}>
                            {m.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleMemberStatus(m.id, m.status)}
                          >
                            {m.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Invitations Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Organization Invitations ({invitations.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {invitations.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">No invitations pending.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invited Email</TableHead>
                        <TableHead>Assigned Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium text-slate-900">{inv.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{inv.role.name}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                inv.status === "PENDING"
                                  ? "warning"
                                  : inv.status === "ACCEPTED"
                                  ? "success"
                                  : "default"
                              }
                            >
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {inv.status === "PENDING" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeInvite(inv.id)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                Revoke
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabContent>

        {/* Tab 5: Roles & Permission Matrix */}
        <TabContent value="roles">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Role-Based Access Control (RBAC)</h3>
                <p className="text-xs text-slate-500">
                  System default roles and custom organization-specific roles.
                </p>
              </div>
              <Button onClick={() => setIsCustomRoleOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Create Custom Role
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((r) => (
                <Card key={r.id} className="border-slate-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                        <Shield className="h-4 w-4 text-indigo-600" />
                        {r.name}
                      </CardTitle>
                      {r.isSystem ? (
                        <Badge variant="info" className="text-[10px]">System Default</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Custom Role</Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">{r.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="text-[11px] font-mono text-slate-500">
                      Permissions: {r.permissions?.length || 0} assigned
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabContent>
      </Tabs>

      {/* Invite Modal */}
      <Dialog
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite Team Member"
        description="Issue an invitation link to a team member and assign a role."
      >
        <form onSubmit={handleSendInvite} className="space-y-4">
          <Input
            label="Email Address *"
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <Select
            label="Assigned Role *"
            value={inviteRoleId}
            onChange={(e) => setInviteRoleId(e.target.value)}
            options={roles.map((r) => ({ label: `${r.name} (${r.description})`, value: r.id }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Custom Role Modal */}
      <Dialog
        isOpen={isCustomRoleOpen}
        onClose={() => setIsCustomRoleOpen(false)}
        title="Create Custom Role"
        description="Define a new role and grant specific domain permissions."
      >
        <form onSubmit={handleCreateCustomRole} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <Input
            label="Role Name *"
            placeholder="e.g. Warehouse Supervisor"
            value={customRoleName}
            onChange={(e) => setCustomRoleName(e.target.value)}
            required
          />
          <Input
            label="Description"
            placeholder="Role purpose summary"
            value={customRoleDesc}
            onChange={(e) => setCustomRoleDesc(e.target.value)}
          />

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Assign Domain Permissions
            </label>
            <div className="space-y-3 rounded-md border border-slate-200 p-3 max-h-48 overflow-y-auto">
              {permissions.map((p) => {
                const isSelected = selectedPerms.includes(p.code);
                return (
                  <label key={p.code} className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPerms([...selectedPerms, p.code]);
                        } else {
                          setSelectedPerms(selectedPerms.filter((c) => c !== p.code));
                        }
                      }}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-900">{p.code}</span>
                      <span className="text-slate-500 block text-[11px]">{p.description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsCustomRoleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Create Custom Role
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
