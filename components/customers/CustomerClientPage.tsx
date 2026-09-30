"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { UserCheck, Plus, Search, Mail, Pencil } from "lucide-react";
import { CustomerInput } from "@/lib/validation/master_data";

interface CustomerItem {
  id: string;
  customerNumber: string;
  displayName: string;
  legalName?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  currency: string;
  status: "ACTIVE" | "INACTIVE";
  billingCity?: string | null;
  billingCountry?: string | null;
  notes?: string | null;
  createdAt: string | Date;
}

interface CustomerClientPageProps {
  initialCustomers: CustomerItem[];
  initialTotal: number;
}

const CURRENCY_OPTIONS = [
  { value: "PKR", label: "PKR - Pakistani Rupee (Rs)" },
  { value: "USD", label: "USD - US Dollar ($)" },
  { value: "EUR", label: "EUR - Euro (€)" },
  { value: "GBP", label: "GBP - British Pound (£)" },
  { value: "AED", label: "AED - UAE Dirham" },
  { value: "SAR", label: "SAR - Saudi Riyal" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "CNY", label: "CNY - Chinese Yuan" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

export function CustomerClientPage({ initialCustomers }: CustomerClientPageProps) {
  const [customers, setCustomers] = React.useState<CustomerItem[]>(initialCustomers);
  const [search, setSearch] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Edit Modal State
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editingCustomer, setEditingCustomer] = React.useState<CustomerItem | null>(null);
  const [editErrorMsg, setEditErrorMsg] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [formData, setFormData] = React.useState<Partial<CustomerInput>>({
    displayName: "",
    legalName: "",
    contactPerson: "",
    email: "",
    phone: "",
    billingCity: "",
    billingCountry: "Pakistan",
    currency: "PKR",
    notes: "",
  });

  const [editFormData, setEditFormData] = React.useState<Partial<CustomerInput>>({
    displayName: "",
    legalName: "",
    contactPerson: "",
    email: "",
    phone: "",
    billingCity: "",
    billingCountry: "Pakistan",
    currency: "PKR",
    notes: "",
    status: "ACTIVE",
  });

  const fetchCustomers = async (query?: string) => {
    try {
      const url = new URL("/api/customers", window.location.origin);
      if (query) url.searchParams.set("search", query);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.items || []);
      }
    } catch {
      // Ignore error
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(search);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create customer");
      }

      setIsDialogOpen(false);
      setFormData({
        displayName: "",
        legalName: "",
        contactPerson: "",
        email: "",
        phone: "",
        billingCity: "",
        billingCountry: "Pakistan",
        currency: "PKR",
        notes: "",
      });
      fetchCustomers(search);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error creating customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (customer: CustomerItem) => {
    setEditingCustomer(customer);
    setEditErrorMsg(null);
    setEditFormData({
      displayName: customer.displayName,
      legalName: customer.legalName || "",
      contactPerson: customer.contactPerson || "",
      email: customer.email || "",
      phone: customer.phone || "",
      billingCity: customer.billingCity || "",
      billingCountry: customer.billingCountry || "Pakistan",
      currency: customer.currency || "PKR",
      notes: customer.notes || "",
      status: customer.status,
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setEditErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/customers/${editingCustomer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update customer");
      }

      setIsEditDialogOpen(false);
      setEditingCustomer(null);
      fetchCustomers(search);
    } catch (err: unknown) {
      setEditErrorMsg(err instanceof Error ? err.message : "Error updating customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Customer Directory & Master Records
          </h1>
          <p className="text-xs text-slate-500">
            Manage customer accounts, billing details, contact info, and credit terms.
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold">
          <Plus className="h-4 w-4" /> Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="h-5 w-5 text-indigo-600" />
                Customer Directory ({customers.length})
              </CardTitle>
              <CardDescription>Master customer dataset scoped to your organization.</CardDescription>
            </div>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search name, number, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-xs w-64"
                />
              </div>
              <Button type="submit" variant="secondary" className="text-xs">
                Search
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No customers found. Click Add Customer to create your first record.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Number</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs font-medium text-indigo-400">
                      {c.customerNumber}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{c.displayName}</span>
                        {c.legalName && <span className="text-[11px] text-slate-300">{c.legalName}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs text-slate-300">
                        {c.contactPerson && <span>{c.contactPerson}</span>}
                        {c.email && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Mail className="h-3 w-3" /> {c.email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {[c.billingCity, c.billingCountry].filter(Boolean).join(", ") || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-slate-200">{c.currency}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "ACTIVE" ? "success" : "default"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 px-2.5 text-xs inline-flex items-center gap-1 hover:border-indigo-400"
                        onClick={() => handleOpenEdit(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Customer Modal */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Add New Customer"
        description="Create a master customer record for your business."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 text-xs text-red-600 bg-red-50 rounded border border-red-200">
              {errorMsg}
            </div>
          )}
          <div>
            <label className="block font-medium text-slate-200 mb-1">Display Name *</label>
            <Input
              required
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-200 mb-1">Legal Name</label>
              <Input
                value={formData.legalName}
                onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                placeholder="Acme Corp LLC"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-200 mb-1">Contact Person</label>
              <Input
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="John Smith"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-200 mb-1">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="billing@acme.com"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-200 mb-1">Phone</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+92 300 1234567"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-200 mb-1">City</label>
              <Input
                value={formData.billingCity}
                onChange={(e) => setFormData({ ...formData, billingCity: e.target.value })}
                placeholder="Peshawar"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-200 mb-1">Country</label>
              <Input
                value={formData.billingCountry}
                onChange={(e) => setFormData({ ...formData, billingCountry: e.target.value })}
                placeholder="Pakistan"
              />
            </div>
          </div>
          <div>
            <Select
              label="Billing Currency"
              options={CURRENCY_OPTIONS}
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save Customer
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Customer Modal */}
      <Dialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        title={`Edit Customer: ${editingCustomer?.customerNumber || ""}`}
        description="Update customer master details, location, and billing currency."
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          {editErrorMsg && (
            <div className="p-3 text-xs text-red-600 bg-red-50 rounded border border-red-200">
              {editErrorMsg}
            </div>
          )}
          <div>
            <label className="block font-medium text-slate-200 mb-1">Display Name *</label>
            <Input
              required
              value={editFormData.displayName || ""}
              onChange={(e) => setEditFormData({ ...editFormData, displayName: e.target.value })}
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-200 mb-1">Legal Name</label>
              <Input
                value={editFormData.legalName || ""}
                onChange={(e) => setEditFormData({ ...editFormData, legalName: e.target.value })}
                placeholder="Acme Corp LLC"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-200 mb-1">Contact Person</label>
              <Input
                value={editFormData.contactPerson || ""}
                onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
                placeholder="John Smith"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-200 mb-1">Email</label>
              <Input
                type="email"
                value={editFormData.email || ""}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder="billing@acme.com"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-200 mb-1">Phone</label>
              <Input
                value={editFormData.phone || ""}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                placeholder="+92 300 1234567"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-200 mb-1">City</label>
              <Input
                value={editFormData.billingCity || ""}
                onChange={(e) => setEditFormData({ ...editFormData, billingCity: e.target.value })}
                placeholder="Peshawar"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-200 mb-1">Country</label>
              <Input
                value={editFormData.billingCountry || ""}
                onChange={(e) => setEditFormData({ ...editFormData, billingCountry: e.target.value })}
                placeholder="Pakistan"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Select
                label="Billing Currency"
                options={CURRENCY_OPTIONS}
                value={editFormData.currency || "PKR"}
                onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
              />
            </div>
            <div>
              <Select
                label="Account Status"
                options={STATUS_OPTIONS}
                value={editFormData.status || "ACTIVE"}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as "ACTIVE" | "INACTIVE" })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Update Customer
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
