"use client";

import React, { useEffect, useState } from "react";
import { api, type CustomRole, type User, ApiError } from "../lib/api-client";

/**
 * RoleManagement
 *
 * Full CRUD for custom roles + role assignment to users.
 * Uses the IAM API endpoints (/api/v1/iam/*).
 *
 * Usage:
 *   <RoleManagement />
 */

interface RoleManagementProps {
  isPlatformAdmin?: boolean;
}

const PERMISSION_GROUPS: Record<string, { label: string; permissions: string[] }> = {
  claims: {
    label: "Claims",
    permissions: [
      "claim:view:own", "claim:view:tenant", "claim:create", "claim:approve",
      "claim:reject", "claim:assign", "claim:review", "claim:request_evidence", "claim:override",
    ],
  },
  farmers: {
    label: "Farmers",
    permissions: ["farmer:view:own", "farmer:view:tenant", "farmer:create", "farmer:update:own", "farmer:update:tenant"],
  },
  land: {
    label: "Land Parcels",
    permissions: ["land:view:own", "land:view:tenant", "land:create", "land:update:own", "land:update:tenant", "land:delete:own", "land:delete:tenant"],
  },
  plans: {
    label: "Policy Plans",
    permissions: ["plan:view", "plan:create", "plan:update", "plan:delete"],
  },
  policies: {
    label: "Policies",
    permissions: ["policy:view:own", "policy:view:tenant", "policy:purchase", "policy:manage"],
  },
  payments: {
    label: "Payments",
    permissions: ["payment:view:own", "payment:view:tenant", "payment:create", "payment:payout"],
  },
  admin: {
    label: "Admin",
    permissions: ["admin:dashboard", "admin:staff", "admin:analytics", "admin:settings"],
  },
  billing: {
    label: "Billing",
    permissions: ["billing:subscribe", "billing:cancel", "billing:view"],
  },
  iam: {
    label: "IAM",
    permissions: ["iam:view", "iam:manage"],
  },
  platform: {
    label: "Platform",
    permissions: ["platform:tenants", "platform:analytics"],
  },
};

export default function RoleManagement({ isPlatformAdmin = false }: RoleManagementProps) {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", description: "", permissions: [] as string[] });
  const [assigningRole, setAssigningRole] = useState<{ userId: string; roleId: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.iam.listRoles(),
      api.admin.listStaff(),
    ])
      .then(([rolesRes, staffRes]) => {
        setRoles((rolesRes as any).data || []);
        setStaff((staffRes as any).data || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load roles and staff");
        setLoading(false);
      });
  }, []);

  const handleCreateRole = async () => {
    try {
      const res = await api.iam.createRole(newRole);
      setRoles((prev) => [...prev, (res as any).data]);
      setShowCreateForm(false);
      setNewRole({ name: "", description: "", permissions: [] });
    } catch (err: any) {
      setError(err.message || "Failed to create role");
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Delete this role? Users assigned to it will lose custom permissions.")) return;
    try {
      await api.iam.deleteRole(roleId);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
    } catch (err: any) {
      setError(err.message || "Failed to delete role");
    }
  };

  const handleAssignRole = async (userId: string, roleId: string | null) => {
    try {
      await api.iam.assignRole(userId, roleId);
      setAssigningRole(null);
    } catch (err: any) {
      setError(err.message || "Failed to assign role");
    }
  };

  const togglePermission = (perm: string) => {
    setNewRole((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Role Management</h2>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-200">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {/* Create Role Button */}
      <button
        onClick={() => setShowCreateForm(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        + Create Custom Role
      </button>

      {/* Create Role Form */}
      {showCreateForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold">New Custom Role</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Role name (e.g., claims-manager)"
              value={newRole.name}
              onChange={(e) => setNewRole((p) => ({ ...p, name: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newRole.description}
              onChange={(e) => setNewRole((p) => ({ ...p, description: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Permission groups */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => (
              <div key={groupKey} className="space-y-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{group.label}</h4>
                {group.permissions.map((perm) => (
                  <label key={perm} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRole.permissions.includes(perm)}
                      onChange={() => togglePermission(perm)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-600 font-mono">{perm}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateRole}
              disabled={!newRole.name || newRole.permissions.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create Role
            </button>
          </div>
        </div>
      )}

      {/* Roles List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Existing Roles ({roles.length})</h3>
        {roles.map((role) => (
          <div key={role.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{role.name}</h4>
                {role.description && (
                  <p className="text-sm text-gray-500">{role.description}</p>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {role.permissions.slice(0, 5).map((p) => (
                    <span key={p} className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      {p}
                    </span>
                  ))}
                  {role.permissions.length > 5 && (
                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                      +{role.permissions.length - 5} more
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDeleteRole(role.id)}
                className="rounded-lg px-3 py-1 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Staff Role Assignment */}
      {staff.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Staff Role Assignment</h3>
          {staff.map((user) => (
            <div key={user.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{user.email}</p>
                <p className="text-sm text-gray-500">Current: {user.role}</p>
              </div>
              <select
                value={assigningRole?.userId === user.id ? assigningRole.roleId : ""}
                onChange={(e) => {
                  const roleId = e.target.value || null;
                  handleAssignRole(user.id, roleId);
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Built-in role only</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
