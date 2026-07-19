"use client";

import React, { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api-client";

/**
 * FraudTierSelector
 *
 * Displays the current fraud detection tier and allows TENANT_ADMIN
 * to switch between FORGE, TITAN, and GOAT tiers.
 *
 * Uses the settings API endpoints (/api/v1/settings/fraud-tier).
 *
 * Usage:
 *   <FraudTierSelector />
 */

type TierName = "forge" | "titan" | "goat";

interface TierInfo {
  name: TierName;
  label: string;
  description: string;
  baseMonthlyFee: number;
  primaryModel: string;
  fallbackModel: string;
  imageCostPerCall: number;
  maxImagesPerClaim: number;
  satelliteEnabled: boolean;
  weatherEnabled: boolean;
}

const TIER_DETAILS: Record<TierName, TierInfo> = {
  forge: {
    name: "forge",
    label: "FORGE",
    description: "Budget tier — fast, cheap models",
    baseMonthlyFee: 0,
    primaryModel: "Gemini 2.0 Flash",
    fallbackModel: "Llama 3.2 90B Vision",
    imageCostPerCall: 0.001,
    maxImagesPerClaim: 3,
    satelliteEnabled: true,
    weatherEnabled: true,
  },
  titan: {
    name: "titan",
    label: "TITAN",
    description: "Balanced — high-quality multimodal",
    baseMonthlyFee: 99,
    primaryModel: "GPT-4o mini",
    fallbackModel: "Claude 3 Haiku",
    imageCostPerCall: 0.005,
    maxImagesPerClaim: 5,
    satelliteEnabled: true,
    weatherEnabled: true,
  },
  goat: {
    name: "goat",
    label: "GOAT",
    description: "Maximum accuracy — best models",
    baseMonthlyFee: 499,
    primaryModel: "GPT-4o",
    fallbackModel: "Claude 3.5 Sonnet",
    imageCostPerCall: 0.015,
    maxImagesPerClaim: 10,
    satelliteEnabled: true,
    weatherEnabled: true,
  },
};

export default function FraudTierSelector() {
  const [currentTier, setCurrentTier] = useState<TierName>("forge");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    api.settings
      .getFraudTier()
      .then((res: any) => {
        setCurrentTier(res.data?.tier || res.data?.currentTier || "forge");
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load fraud tier settings");
        setLoading(false);
      });
  }, []);

  const handleSelectTier = async (tier: TierName) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.settings.updateFraudTier(tier);
      setCurrentTier(tier);
      setSuccess(`Fraud tier switched to ${TIER_DETAILS[tier].label}`);
    } catch (err: any) {
      setError(err.message || "Failed to update fraud tier");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Fraud Detection Tier</h2>
      <p className="text-sm text-gray-500">
        Select the fraud detection tier that determines which AI models analyze claims.
        Higher tiers use more accurate models but cost more per analysis.
      </p>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-200">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 border border-green-200">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(Object.values(TIER_DETAILS) as TierInfo[]).map((tier) => (
          <button
            key={tier.name}
            onClick={() => handleSelectTier(tier.name)}
            disabled={saving || currentTier === tier.name}
            className={`relative rounded-xl border-2 p-5 text-left transition-all ${
              currentTier === tier.name
                ? "border-blue-500 bg-blue-50 shadow-md"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
            } disabled:cursor-default`}
          >
            {currentTier === tier.name && (
              <span className="absolute top-2 right-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Active
              </span>
            )}

            <h3 className="text-lg font-bold text-gray-900">{tier.label}</h3>
            <p className="mt-1 text-sm text-gray-500">{tier.description}</p>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Monthly base</span>
                <span className="font-medium">
                  {tier.baseMonthlyFee === 0 ? "Free" : formatCurrency(tier.baseMonthlyFee)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Per image</span>
                <span className="font-medium">{formatCurrency(tier.imageCostPerCall)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Max images/claim</span>
                <span className="font-medium">{tier.maxImagesPerClaim}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Primary model</span>
                <span className="font-medium text-xs">{tier.primaryModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fallback model</span>
                <span className="font-medium text-xs">{tier.fallbackModel}</span>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              {tier.satelliteEnabled && (
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                  Satellite
                </span>
              )}
              {tier.weatherEnabled && (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                  Weather
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {saving && (
        <div className="flex items-center justify-center py-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
          <span className="ml-2 text-sm text-gray-500">Updating tier...</span>
        </div>
      )}
    </div>
  );
}
