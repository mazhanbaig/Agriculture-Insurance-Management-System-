"use client";

import React, { useEffect, useState } from "react";
import { api, type UsageSummary, type Invoice } from "../lib/api-client";

/**
 * BillingDashboard
 *
 * Shows subscription status, usage summary, and invoice list.
 * Uses the billing API endpoints (/api/v1/billing/*).
 *
 * Usage:
 *   <BillingDashboard />
 */

export default function BillingDashboard() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.billing.usage(),
      api.billing.listInvoices(),
      api.billing.status(),
    ])
      .then(([usageRes, invoicesRes, statusRes]) => {
        setUsage((usageRes as any).data);
        setInvoices((invoicesRes as any).data || []);
        setSubscription((statusRes as any).data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load billing data");
        setLoading(false);
      });
  }, []);

  const handleSubscribe = async () => {
    try {
      const res = await api.billing.subscribe();
      window.open((res as any).data.url, "_blank");
    } catch (err: any) {
      setError(err.message || "Failed to start subscription");
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Cancel subscription? Billing will be disabled at end of period.")) return;
    try {
      await api.billing.cancel();
      setSubscription({ ...subscription, active: false });
    } catch (err: any) {
      setError(err.message || "Failed to cancel subscription");
    }
  };

  const handlePayInvoice = async (invoiceId: string) => {
    try {
      await api.billing.payInvoice(invoiceId);
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId ? { ...inv, status: "PAID" as const } : inv
        )
      );
    } catch (err: any) {
      setError(err.message || "Failed to pay invoice");
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      await api.billing.generateInvoice();
      // Refresh invoices
      const res = await api.billing.listInvoices();
      setInvoices((res as any).data || []);
    } catch (err: any) {
      setError(err.message || "Failed to generate invoice");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Billing</h2>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-200">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {/* Subscription Status */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h3>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${subscription?.active ? "bg-green-500" : "bg-gray-400"}`} />
              <span className="font-medium">{subscription?.active ? "Active" : "Inactive"}</span>
            </div>
            {subscription?.plan && (
              <p className="text-sm text-gray-500">Plan: {subscription.plan}</p>
            )}
            {subscription?.currentPeriodEnd && (
              <p className="text-sm text-gray-500">
                Next billing: {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {!subscription?.active && (
              <button
                onClick={handleSubscribe}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Subscribe
              </button>
            )}
            {subscription?.active && (
              <button
                onClick={handleCancelSubscription}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Usage Summary */}
      {usage && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage This Month</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-2xl font-bold text-blue-700">{usage.totalCalls}</p>
              <p className="text-sm text-blue-600">Total API Calls</p>
            </div>
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-2xl font-bold text-green-700">{formatCurrency(usage.totalCost)}</p>
              <p className="text-sm text-green-600">Total Cost</p>
            </div>
            <div className="rounded-lg bg-purple-50 p-4">
              <p className="text-2xl font-bold text-purple-700">{Object.keys(usage.byService).length}</p>
              <p className="text-sm text-purple-600">Services Used</p>
            </div>
          </div>
          {Object.keys(usage.byService).length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">By Service</h4>
              <div className="space-y-2">
                {Object.entries(usage.byService).map(([service, data]) => (
                  <div key={service} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-sm font-medium text-gray-700 capitalize">{service}</span>
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span>{data.calls} calls</span>
                      <span>{formatCurrency(data.cost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoices */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Invoices</h3>
          <button
            onClick={handleGenerateInvoice}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Generate Now
          </button>
        </div>

        {invoices.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No invoices yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2">Invoice #</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="text-sm text-gray-700 hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono font-medium">{inv.invoiceNumber}</td>
                    <td className="px-3 py-2">
                      {new Date(inv.periodStart).toLocaleDateString()} - {new Date(inv.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 font-medium">{formatCurrency(inv.totalAmount)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        inv.status === "PAID" ? "bg-green-100 text-green-700" :
                        inv.status === "DRAFT" ? "bg-yellow-100 text-yellow-700" :
                        inv.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      {inv.status !== "PAID" && (
                        <button
                          onClick={() => handlePayInvoice(inv.id)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                        >
                          Pay Now
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
