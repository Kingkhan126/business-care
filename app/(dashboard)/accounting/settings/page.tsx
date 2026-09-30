"use client";

import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, CheckCircle2 } from 'lucide-react';

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface MappingItem {
  mappingKey: string;
  accountId: string;
}

const MAPPING_LABELS: Record<string, { label: string; description: string }> = {
  ACCOUNTS_RECEIVABLE: {
    label: 'Accounts Receivable (AR)',
    description: 'Asset account debited when customer invoices are issued.',
  },
  SALES_REVENUE: {
    label: 'Sales Revenue',
    description: 'Revenue account credited for product and service sales.',
  },
  INVENTORY_ASSET: {
    label: 'Inventory Asset',
    description: 'Asset account debited on stock receive / credited on sale.',
  },
  COGS_EXPENSE: {
    label: 'Cost of Goods Sold (COGS)',
    description: 'Expense account debited when inventory is sold or adjusted down.',
  },
  ACCOUNTS_PAYABLE: {
    label: 'Accounts Payable (AP)',
    description: 'Liability account credited when vendor bills are received.',
  },
  CUSTOMER_PAYMENT_CLEARING: {
    label: 'Bank / Cash (Customer Payments)',
    description: 'Asset account debited when customer payments are collected.',
  },
  VENDOR_PAYMENT_CLEARING: {
    label: 'Bank / Cash (Vendor Payments)',
    description: 'Asset account credited when paying vendor bills.',
  },
  SALES_DISCOUNT: {
    label: 'Sales Discount',
    description: 'Contra-revenue account for customer settlement discounts.',
  },
  PURCHASE_DISCOUNT: {
    label: 'Purchase Discount',
    description: 'Expense-reduction account for early vendor payment discounts.',
  },
};

export default function AccountMappingsPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accRes, mapRes] = await Promise.all([
        fetch('/api/accounting/accounts'),
        fetch('/api/accounting/mappings'),
      ]);

      const accData = await accRes.json();
      const mapData = await mapRes.json();

      if (accData.success) {
        setAccounts(accData.data);
      }
      if (mapData.success) {
        const mapObj: Record<string, string> = {};
        mapData.data.forEach((m: MappingItem) => {
          mapObj[m.mappingKey] = m.accountId;
        });
        setMappings(mapObj);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load accounting settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (mappingKey: string, accountId: string) => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/accounting/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappingKey, accountId }),
      });
      const data = await res.json();
      if (data.success) {
        setMappings((prev) => ({ ...prev, [mappingKey]: accountId }));
        setMessage(`Updated mapping for ${mappingKey}`);
      } else {
        setError(data.error || 'Failed to update mapping');
      }
    } catch (err: any) {
      setError(err.message || 'Error saving mapping');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Account Mappings & Settings</h1>
          <p className="text-sm text-slate-500">
            Configure system default GL accounts for automated document posting.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {message}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading account mappings...</div>
      ) : (
        <div className="border border-slate-200 bg-white rounded-lg divide-y divide-slate-100 shadow-xs">
          {Object.entries(MAPPING_LABELS).map(([key, meta]) => {
            const currentAccountId = mappings[key] || '';
            return (
              <div key={key} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="max-w-md">
                  <h3 className="font-bold text-xs text-slate-900">{meta.label}</h3>
                  <p className="text-[11px] text-slate-500">{meta.description}</p>
                  <span className="inline-block mt-1 font-mono text-[10px] text-slate-400">
                    KEY: {key}
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <select
                    value={currentAccountId}
                    onChange={(e) => handleSave(key, e.target.value)}
                    disabled={saving}
                    className="w-full md:w-64 text-xs p-2 border border-slate-300 rounded bg-white text-slate-900 font-mono"
                  >
                    <option value="">-- Select GL Account --</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
