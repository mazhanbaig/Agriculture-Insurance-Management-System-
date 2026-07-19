import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import {
  PERMISSIONS,
  getDefaultPermissionsForRole,
  type Permission,
} from "../config/permissions";

// ─── Custom Role CRUD ────────────────────────────────────────────

export async function listCustomRoles(tenantId: string) {
  return prisma.customRole.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCustomRole(roleId: string, tenantId: string) {
  const role = await prisma.customRole.findFirst({
    where: { id: roleId, tenantId },
  });
  if (!role) throw new AppError("Custom role not found", 404);
  return role;
}

export async function createCustomRole(
  tenantId: string,
  data: { name: string; description?: string; permissions: string[] }
) {
  // Validate all permissions exist
  const validPermissions = Object.values(PERMISSIONS);
  const invalidPerms = data.permissions.filter(
    (p) => !validPermissions.includes(p as Permission)
  );
  if (invalidPerms.length > 0) {
    throw new AppError(
      `Invalid permissions: ${invalidPerms.join(", ")}`,
      400
    );
  }

  // Check uniqueness within tenant
  const existing = await prisma.customRole.findUnique({
    where: { tenantId_name: { tenantId, name: data.name } },
  });
  if (existing) {
    throw new AppError(
      `A custom role with name "${data.name}" already exists in this tenant`,
      409
    );
  }

  return prisma.customRole.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description,
      permissions: data.permissions,
    },
  });
}

export async function updateCustomRole(
  roleId: string,
  tenantId: string,
  data: { name?: string; description?: string; permissions?: string[]; isActive?: boolean }
) {
  const role = await getCustomRole(roleId, tenantId);

  if (data.permissions) {
    const validPermissions = Object.values(PERMISSIONS);
    const invalidPerms = data.permissions.filter(
      (p) => !validPermissions.includes(p as Permission)
    );
    if (invalidPerms.length > 0) {
      throw new AppError(`Invalid permissions: ${invalidPerms.join(", ")}`, 400);
    }
  }

  if (data.name && data.name !== role.name) {
    const existing = await prisma.customRole.findUnique({
      where: { tenantId_name: { tenantId, name: data.name } },
    });
    if (existing) {
      throw new AppError(`A custom role with name "${data.name}" already exists`, 409);
    }
  }

  return prisma.customRole.update({
    where: { id: roleId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.permissions !== undefined && { permissions: data.permissions }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

export async function deleteCustomRole(roleId: string, tenantId: string) {
  await getCustomRole(roleId, tenantId);

  // Check if any users are assigned this role
  const userCount = await prisma.user.count({
    where: { customRoleId: roleId },
  });
  if (userCount > 0) {
    throw new AppError(
      `Cannot delete: ${userCount} user(s) are assigned to this role. Reassign them first.`,
      400
    );
  }

  return prisma.customRole.delete({ where: { id: roleId } });
}

// ─── Role Assignment ─────────────────────────────────────────────

export async function assignCustomRole(
  userId: string,
  customRoleId: string | null,
  tenantId: string
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });
  if (!user) throw new AppError("User not found", 404);

  // Cannot assign custom role to PLATFORM_ADMIN
  if (user.role === "PLATFORM_ADMIN") {
    throw new AppError("Cannot assign custom role to platform admins", 400);
  }

  if (customRoleId) {
    const role = await getCustomRole(customRoleId, tenantId);
    if (!role.isActive) {
      throw new AppError("Cannot assign an inactive custom role", 400);
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: { customRoleId },
    select: { id: true, email: true, role: true, customRoleId: true },
  });
}

// ─── Permission Resolution ───────────────────────────────────────

/**
 * Resolve the full set of permissions for a user.
 *
 * Resolution order:
 * 1. PLATFORM_ADMIN → all permissions
 * 2. If user has a customRole → use that role's permissions
 * 3. Otherwise → use built-in role defaults
 */
export async function resolveUserPermissions(userId: string): Promise<Permission[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { customRole: true },
  });
  if (!user) throw new AppError("User not found", 404);

  // Platform admin gets everything
  if (user.role === "PLATFORM_ADMIN") {
    return Object.values(PERMISSIONS);
  }

  // If user has a custom role, use its permissions
  if (user.customRole && user.customRole.isActive) {
    return (user.customRole.permissions as string[]) as Permission[];
  }

  // Fall back to built-in role defaults
  return getDefaultPermissionsForRole(user.role);
}

/**
 * Check if a user has a specific permission.
 */
export async function userHasPermission(
  userId: string,
  permission: Permission
): Promise<boolean> {
  const permissions = await resolveUserPermissions(userId);
  return permissions.includes(permission);
}

/**
 * Get all available permissions (for UI rendering).
 */
export function getAllPermissions() {
  return Object.entries(PERMISSIONS).map(([key, value]) => ({
    key,
    value,
    category: value.split(":")[0],
  }));
}
