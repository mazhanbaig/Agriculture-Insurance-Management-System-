"use client";

import React, { useEffect, useState } from "react";
import { api, type TenantField } from "../lib/api-client";

/**
 * DynamicFarmerForm
 *
 * Renders a form with fields dynamically configured by the tenant.
 * Fetches the field schema from GET /api/v1/farmers/fields
 * and renders appropriate inputs for each field type.
 *
 * Usage:
 *   <DynamicFarmerForm onSubmit={(customData) => api.farmers.createProfile({ ...customData })} />
 */

interface DynamicFarmerFormProps {
  onSubmit: (customData: Record<string, any>) => Promise<void>;
  initialValues?: Record<string, any>;
  disabled?: boolean;
}

const FIELD_COMPONENTS: Record<
  string,
  (props: {
    field: TenantField;
    value: any;
    onChange: (key: string, value: any) => void;
    disabled?: boolean;
  }) => React.ReactElement
> = {
  text: ({ field, value, onChange, disabled }) => (
    <input
      type="text"
      id={field.fieldKey}
      value={value || ""}
      onChange={(e) => onChange(field.fieldKey, e.target.value)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      placeholder={`Enter ${field.label}`}
      required={field.required}
      disabled={disabled}
    />
  ),

  number: ({ field, value, onChange, disabled }) => (
    <input
      type="number"
      id={field.fieldKey}
      value={value || ""}
      onChange={(e) => onChange(field.fieldKey, parseFloat(e.target.value) || "")}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      placeholder={`Enter ${field.label}`}
      required={field.required}
      disabled={disabled}
    />
  ),

  date: ({ field, value, onChange, disabled }) => (
    <input
      type="date"
      id={field.fieldKey}
      value={value || ""}
      onChange={(e) => onChange(field.fieldKey, e.target.value)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      required={field.required}
      disabled={disabled}
    />
  ),

  dropdown: ({ field, value, onChange, disabled }) => {
    const options = Array.isArray(field.options)
      ? field.options.map((o) => (typeof o === "string" ? { label: o, value: o } : o))
      : [];

    return (
      <select
        id={field.fieldKey}
        value={value || ""}
        onChange={(e) => onChange(field.fieldKey, e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        required={field.required}
        disabled={disabled}
      >
        <option value="">Select {field.label}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  },

  checkbox: ({ field, value, onChange, disabled }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        id={field.fieldKey}
        checked={value || false}
        onChange={(e) => onChange(field.fieldKey, e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
        disabled={disabled}
      />
      <span className="text-sm text-gray-700">{field.label}</span>
    </label>
  ),

  file: ({ field, value, onChange, disabled }) => (
    <input
      type="file"
      id={field.fieldKey}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onChange(field.fieldKey, file);
      }}
      className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed"
      disabled={disabled}
    />
  ),
};

export default function DynamicFarmerForm({
  onSubmit,
  initialValues = {},
  disabled = false,
}: DynamicFarmerFormProps) {
  const [fields, setFields] = useState<TenantField[]>([]);
  const [customData, setCustomData] = useState<Record<string, any>>(initialValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.farmers
      .getFields()
      .then((data) => {
        setFields(data as any);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load custom fields");
        setLoading(false);
      });
  }, []);

  const handleChange = (key: string, value: any) => {
    setCustomData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await onSubmit(customData);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (fields.length === 0) {
    return null; // No custom fields configured — render nothing
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields
          .filter((f) => f.isActive !== false)
          .sort((a, b) => a.order - b.order)
          .map((field) => {
            const Component = FIELD_COMPONENTS[field.fieldType];
            if (!Component) return null;

            return (
              <div key={field.fieldKey} className={field.fieldType === "checkbox" ? "" : "space-y-1"}>
                {field.fieldType !== "checkbox" && (
                  <label
                    htmlFor={field.fieldKey}
                    className="block text-sm font-medium text-gray-700"
                  >
                    {field.label}
                    {field.required && <span className="ml-1 text-red-500">*</span>}
                  </label>
                )}
                <Component
                  field={field}
                  value={customData[field.fieldKey]}
                  onChange={handleChange}
                  disabled={disabled}
                />
                {field.required &&
                  field.fieldType !== "checkbox" &&
                  !customData[field.fieldKey] && (
                    <p className="mt-1 text-xs text-red-500">This field is required</p>
                  )}
              </div>
            );
          })}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving || disabled}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
