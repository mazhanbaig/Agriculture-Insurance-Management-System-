import { prisma } from "../lib/prisma";
import { supabase } from "../lib/supabase";
import { AppError } from "../middleware/errorHandler";

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { farmer: true, tenant: { select: { id: true, name: true, slug: true, config: true } } },
  });
  if (!user) throw new AppError("User not found", 404);
  return user;
}

export async function updateProfile(userId: string, data: { phone?: string }) {
  return prisma.user.update({ where: { id: userId }, data });
}

export async function updateUserRole(
  currentUserId: string,
  targetUserId: string,
  role: string
) {
  const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });
  if (!currentUser || currentUser.role !== "PLATFORM_ADMIN") {
    throw new AppError("Only platform admins can change user roles", 403);
  }
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) throw new AppError("User not found", 404);
  return prisma.user.update({
    where: { id: targetUserId },
    data: { role: role as any },
  });
}

export async function listUsers(page: number, limit: number, tenantId?: string) {
  const skip = (page - 1) * limit;
  const where: Record<string, any> = {};
  if (tenantId) where.tenantId = tenantId;
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.user.count({ where }),
  ]);
  return {
    users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
  role: string;
  tenantSlug?: string;
}) {
  let tenantId: string;
  if (data.tenantSlug) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: data.tenantSlug } });
    if (!tenant) throw new AppError("Tenant not found", 404);
    tenantId = tenant.id;
  } else {
    const defaultTenant = await prisma.tenant.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
    if (!defaultTenant) throw new AppError("No active tenant found. Please provide a tenant slug.", 400);
    tenantId = defaultTenant.id;
  }

  let authData, error;
  try {
    const result = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });
    authData = result.data;
    error = result.error;
  } catch (supabaseErr: any) {
    throw new AppError(
      supabaseErr?.message || "Authentication service unavailable. Please try again later.",
      503
    );
  }

  if (error) {
    const msg = error.message || "";
    if (msg.includes("already registered") || msg.includes("already an account")) {
      throw new AppError("Email already registered", 409);
    }
    if (msg.includes("rate limit") || msg.includes("too many")) {
      throw new AppError("Too many registration attempts. Please wait a moment and try again.", 429);
    }
    throw new AppError(msg || "Registration failed. Please try again.", 400);
  }
  if (!authData?.user) throw new AppError("Failed to create user", 500);

  const user = await prisma.user.create({
    data: { tenantId, authId: authData.user.id, email: data.email, role: data.role as any },
  });

  if (data.role === "FARMER") {
    await prisma.farmer.create({
      data: { tenantId, userId: user.id, fullName: data.name, cnicNumber: "0000000000000" },
    });
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (sessionError) throw new AppError("Account created but login failed", 500);

  return {
    user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
    accessToken: sessionData.session?.access_token,
    token: sessionData.session?.access_token,
  };
}

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new AppError("Invalid email or password", 401);

  const authId = data.user.id;
  let user = await prisma.user.findUnique({ where: { authId } });
  if (!user) {
    const defaultTenant = await prisma.tenant.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
    user = await prisma.user.findFirst({
      where: { email, tenantId: defaultTenant?.id || "" },
    });
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { authId, lastLoginAt: new Date() },
      });
    }
  }
  if (!user) throw new AppError("User not found. Please register first.", 404);

  user = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const farmer = await prisma.farmer.findUnique({ where: { userId: user.id } });

  return {
    id: user.id,
    email: user.email,
    name: farmer?.fullName || user.email.split("@")[0],
    role: user.role,
    tenantId: user.tenantId,
    farmerId: farmer?.id || null,
    avatar: farmer?.profilePhotoUrl || null,
    accessToken: data.session?.access_token,
    token: data.session?.access_token,
  };
}

export async function oauthCallback(data: {
  email: string;
  name?: string;
  avatar?: string;
  provider: string;
  providerAccountId: string;
}) {
  const activeTenant = await prisma.tenant.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
  if (!activeTenant) throw new AppError("No active tenant available. Please contact support.", 503);
  const tenantId = activeTenant.id;
  const { email } = data;

  let user = await prisma.user.findFirst({ where: { email, tenantId } });
  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
  } else {
    user = await prisma.user.create({
      data: { tenantId, authId: `oauth_${data.provider}_${data.providerAccountId}`, email, role: "FARMER" },
    });
  }

  const farmer = await prisma.farmer.findUnique({ where: { userId: user.id } });
  if (!farmer && data.name) {
    await prisma.farmer.create({
      data: { tenantId, userId: user.id, fullName: data.name, cnicNumber: "0000000000000" },
    });
  }

  return {
    id: user.id,
    email: user.email,
    name: farmer?.fullName || data.name || user.email.split("@")[0],
    role: user.role,
    tenantId: user.tenantId,
    farmerId: farmer?.id || null,
    needsSetup: !user.tenantId,
  };
}

export async function completeOAuthSetup(userId: string, data: {
  role: string;
  tenantSlug?: string;
  phone?: string;
}) {
  let tenantId: string | null = null;
  if (data.tenantSlug) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: data.tenantSlug } });
    if (!tenant) throw new AppError("Tenant not found", 404);
    tenantId = tenant.id;
  }

  const updateData: any = { role: data.role as any };
  if (tenantId != null) updateData.tenantId = tenantId;
  if (data.phone) updateData.phone = data.phone;

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  };
}

export async function forgotPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`,
  });
  if (error) throw new AppError(error.message, 400);
  return { message: "Password reset email sent" };
}
