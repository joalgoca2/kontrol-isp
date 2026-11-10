"use server";

import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { searchIdsWithUnaccent } from "@/lib/search";
import {
  changePasswordSchema,
  createUserSchema,
  updateProfileSchema,
  updateUserSchema,
} from "@/lib/validations/auth";
import { emailSchema, passwordSchema } from "@/lib/validations/common";
import { auth } from "@/auth";
import type { ApiResponse, RoleName, User } from "@/types";

export interface UserWithRoles extends User {
  roles?: string[];
  brand?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export async function getUserById(
  userId: string
): Promise<ApiResponse<User>> {
  try {
    const rawUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!rawUser) {
      return { success: false, error: "User not found." };
    }

    const user: User = {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      image: rawUser.image,
      isActive: rawUser.isActive,
      bio: rawUser.bio,
      locale: rawUser.locale,
      timezone: rawUser.timezone,
      brandId: rawUser.brandId,
      createdAt: rawUser.createdAt,
      updatedAt: rawUser.updatedAt,
    };

    return { success: true, data: user };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch user.";
    return { success: false, error: message };
  }
}

export async function getUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  brandId?: string;
}): Promise<
  ApiResponse<{
    users: UserWithRoles[];
    total: number;
    totalPages: number;
    activeCount: number;
    superAdminsCount: number;
    adminsCount: number;
    techniciansCount: number;
    billingCount: number;
    supportCount: number;
    operatorsCount: number;
  }>
> {
  try {
    const session = await auth();
    const callerRoles = session?.user?.roles ?? [];
    const isCallerSuperAdmin = callerRoles.includes("SUPER_ADMIN");
    const callerBrandId = session?.user?.brandId;

    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(50, Math.max(1, params?.limit ?? 10));
    const skip = (page - 1) * limit;

    const baseConditions: Record<string, unknown>[] = [];

    if (!isCallerSuperAdmin) {
      if (callerBrandId) {
        baseConditions.push({ brandId: callerBrandId });
      } else {
        baseConditions.push({ id: session?.user?.id ?? "none" });
      }
      baseConditions.push({
        roles: {
          none: {
            role: {
              name: "SUPER_ADMIN",
            },
          },
        },
      });
    } else {
      if (params?.brandId && params.brandId !== "ALL") {
        baseConditions.push({ brandId: params.brandId });
      }
    }

    const andConditions: Record<string, unknown>[] = [...baseConditions];

    if (params?.search?.trim()) {
      const matchedIds = await searchIdsWithUnaccent("users", params.search);
      andConditions.push({ id: { in: matchedIds } });
    }

    if (params?.role) {
      const matchRole =
        params.role === "TECHNICIAN"
          ? { in: ["TECHNICIAN", "USER"] }
          : params.role;
      andConditions.push({
        roles: {
          some: {
            role: {
              name: matchRole,
            },
          },
        },
      });
    }

    if (params?.status === "active") {
      andConditions.push({ isActive: true });
    } else if (params?.status === "inactive") {
      andConditions.push({ isActive: false });
    }

    const whereCondition =
      andConditions.length > 0 ? { AND: andConditions } : {};
    const baseWhereCondition =
      baseConditions.length > 0 ? { AND: baseConditions } : {};

    const [
      total,
      activeCount,
      superAdminsCount,
      adminsCount,
      techniciansCount,
      billingCount,
      supportCount,
      rawUsers,
    ] = await Promise.all([
      prisma.user.count({ where: whereCondition }),
      prisma.user.count({
        where: {
          ...baseWhereCondition,
          isActive: true,
        },
      }),
      prisma.user.count({
        where: {
          ...baseWhereCondition,
          roles: {
            some: {
              role: {
                name: "SUPER_ADMIN",
              },
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          ...baseWhereCondition,
          roles: {
            some: {
              role: {
                name: "ADMIN",
              },
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          ...baseWhereCondition,
          roles: {
            some: {
              role: {
                name: { in: ["TECHNICIAN", "USER"] },
              },
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          ...baseWhereCondition,
          roles: {
            some: {
              role: {
                name: "BILLING",
              },
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          ...baseWhereCondition,
          roles: {
            some: {
              role: {
                name: "SUPPORT",
              },
            },
          },
        },
      }),
      prisma.user.findMany({
        where: whereCondition,
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          roles: {
            include: {
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const users: UserWithRoles[] = rawUsers.map((u) => {
      const roles = u.roles.map((r) =>
        r.role.name === "USER" ? "TECHNICIAN" : r.role.name
      );

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        isActive: u.isActive,
        bio: u.bio,
        locale: u.locale,
        timezone: u.timezone,
        brandId: u.brandId,
        brand: u.brand,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        roles,
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      success: true,
      data: {
        users,
        total,
        totalPages,
        activeCount,
        superAdminsCount,
        adminsCount,
        techniciansCount,
        billingCount,
        supportCount,
        operatorsCount: techniciansCount,
      },
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch users.";
    return { success: false, error: message };
  }
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  roleName: RoleName;
  brandId?: string | null;
}): Promise<ApiResponse<UserWithRoles>> {
  try {
    const session = await auth();
    const callerRoles = session?.user?.roles ?? [];
    const isCallerSuperAdmin = callerRoles.includes("SUPER_ADMIN");
    const isCallerAdmin = isCallerSuperAdmin || callerRoles.includes("ADMIN");
    const callerBrandId = session?.user?.brandId;

    if (!isCallerAdmin) {
      return {
        success: false,
        error: "No tienes permisos para registrar usuarios.",
      };
    }

    const parsed = createUserSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid input.";
      return { success: false, error: firstError };
    }

    const { name, email, password, roleName, brandId } = parsed.data;

    if (roleName === "SUPER_ADMIN") {
      return {
        success: false,
        error:
          "No se permite crear usuarios con el rol SuperAdmin. " +
          "Únicamente existe un SuperAdmin en el sistema.",
      };
    }

    let targetBrandId: string | null = null;

    if (!isCallerSuperAdmin) {
      if (!callerBrandId) {
        return {
          success: false,
          error: "No tienes una marca asignada para registrar usuarios.",
        };
      }
      targetBrandId = callerBrandId;
    } else {
      targetBrandId = brandId ?? null;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return {
        success: false,
        error: "EMAIL_EXISTS",
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = await prisma.role.findUnique({ where: { name: roleName } });

    if (!role) {
      return { success: false, error: `Role ${roleName} does not exist.` };
    }

    let initialTimezone = "America/Bogota";
    let initialLocale = "es";

    if (targetBrandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: targetBrandId },
        select: { timezone: true, locale: true },
      });
      if (brand?.timezone) initialTimezone = brand.timezone;
      if (brand?.locale) initialLocale = brand.locale;
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isActive: true,
        brandId: targetBrandId,
        timezone: initialTimezone,
        locale: initialLocale,
        roles: {
          create: {
            roleId: role.id,
          },
        },
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    const user: UserWithRoles = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      image: newUser.image,
      isActive: newUser.isActive,
      bio: newUser.bio,
      locale: newUser.locale,
      timezone: newUser.timezone,
      brandId: newUser.brandId,
      brand: newUser.brand,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
      roles: newUser.roles.map((r) => r.role.name),
    };

    return {
      success: true,
      data: user,
      message: "User created successfully.",
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create user.";
    return { success: false, error: message };
  }
}

export async function updateUser(
  userId: string,
  data: {
    name: string;
    email: string;
    password?: string;
    roleName: RoleName;
    isActive: boolean;
    brandId?: string | null;
  }
): Promise<ApiResponse<UserWithRoles>> {
  try {
    const session = await auth();
    const callerRoles = session?.user?.roles ?? [];
    const isCallerSuperAdmin = callerRoles.includes("SUPER_ADMIN");
    const isCallerAdmin = isCallerSuperAdmin || callerRoles.includes("ADMIN");
    const callerBrandId = session?.user?.brandId;

    if (!isCallerAdmin) {
      return {
        success: false,
        error: "No tienes permisos para modificar usuarios.",
      };
    }

    const parsed = updateUserSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid input.";
      return { success: false, error: firstError };
    }

    const { name, email, password } = parsed.data;
    let { roleName, isActive, brandId } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        roles: { include: { role: true } },
      },
    });

    if (!existingUser) {
      return { success: false, error: "Usuario no encontrado." };
    }

    if (
      !isCallerSuperAdmin &&
      callerBrandId &&
      existingUser.brandId !== callerBrandId
    ) {
      return {
        success: false,
        error: "No tienes permisos para modificar usuarios de otra marca.",
      };
    }

    const isTargetSuperAdmin =
      existingUser.roles.some((r) => r.role.name === "SUPER_ADMIN") ||
      existingUser.email === "admin@remotemonkeys.ai";

    if (isTargetSuperAdmin) {
      roleName = "SUPER_ADMIN";
      isActive = true;
      brandId = null;
    }

    if (!isCallerSuperAdmin) {
      if (roleName === "SUPER_ADMIN") {
        return {
          success: false,
          error: "No tienes permisos para asignar el rol SuperAdmin.",
        };
      }
      brandId = callerBrandId ?? existingUser.brandId;
    }

    if (email.toLowerCase() !== existingUser.email.toLowerCase()) {
      const emailOccupied = await prisma.user.findUnique({
        where: { email },
      });
      if (emailOccupied) {
        return { success: false, error: "EMAIL_EXISTS" };
      }
    }

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      return { success: false, error: `Role ${roleName} does not exist.` };
    }

    const updateData: Record<string, unknown> = {
      name,
      email,
      isActive,
      brandId: isCallerSuperAdmin
        ? (brandId ?? null)
        : existingUser.brandId,
    };

    if (password && password.trim().length >= 8) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await prisma.userRole.deleteMany({ where: { userId } });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        roles: {
          create: {
            roleId: role.id,
          },
        },
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    const user: UserWithRoles = {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      image: updated.image,
      isActive: updated.isActive,
      bio: updated.bio,
      locale: updated.locale,
      timezone: updated.timezone,
      brandId: updated.brandId,
      brand: updated.brand,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      roles: updated.roles.map((r) => r.role.name),
    };

    return {
      success: true,
      data: user,
      message: "User updated successfully.",
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update user.";
    return { success: false, error: message };
  }
}

export async function deleteUser(
  userId: string
): Promise<ApiResponse<void>> {
  try {
    const session = await auth();
    const callerRoles = session?.user?.roles ?? [];
    const isCallerSuperAdmin = callerRoles.includes("SUPER_ADMIN");
    const callerBrandId = session?.user?.brandId;

    if (session?.user?.id === userId) {
      return {
        success: false,
        error: "No puedes eliminar tu propia cuenta de usuario.",
      };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    if (!targetUser) {
      return { success: false, error: "Usuario no encontrado." };
    }

    const isTargetSuperAdmin =
      targetUser.roles.some((r) => r.role.name === "SUPER_ADMIN") ||
      targetUser.email === "admin@remotemonkeys.ai";

    if (isTargetSuperAdmin) {
      return {
        success: false,
        error: "El usuario SuperAdmin del sistema no puede ser eliminado.",
      };
    }

    if (!isCallerSuperAdmin) {
      if (!callerRoles.includes("ADMIN")) {
        return {
          success: false,
          error: "No tienes permisos para eliminar usuarios.",
        };
      }
      if (callerBrandId && targetUser.brandId !== callerBrandId) {
        return {
          success: false,
          error: "No tienes permisos para eliminar usuarios de otra marca.",
        };
      }
    }

    await prisma.user.delete({ where: { id: userId } });
    return { success: true, message: "User deleted successfully." };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to delete user.";
    return { success: false, error: message };
  }
}

export async function toggleUserStatus(
  userId: string,
  isActive: boolean
): Promise<ApiResponse<void>> {
  try {
    const session = await auth();
    const callerRoles = session?.user?.roles ?? [];
    const isCallerSuperAdmin = callerRoles.includes("SUPER_ADMIN");
    const callerBrandId = session?.user?.brandId;

    if (session?.user?.id === userId && !isActive) {
      return {
        success: false,
        error: "No puedes desactivar tu propia cuenta de usuario.",
      };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    if (!targetUser) {
      return { success: false, error: "Usuario no encontrado." };
    }

    const isTargetSuperAdmin =
      targetUser.roles.some((r) => r.role.name === "SUPER_ADMIN") ||
      targetUser.email === "admin@remotemonkeys.ai";

    if (isTargetSuperAdmin && !isActive) {
      return {
        success: false,
        error: "El usuario SuperAdmin no puede ser desactivado.",
      };
    }

    if (!isCallerSuperAdmin) {
      if (!callerRoles.includes("ADMIN")) {
        return {
          success: false,
          error: "No tienes permisos para cambiar el estado de usuarios.",
        };
      }
      if (callerBrandId && targetUser.brandId !== callerBrandId) {
        return {
          success: false,
          error: "No tienes permisos para modificar usuarios de otra marca.",
        };
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    return { success: true, message: "Estado de usuario actualizado." };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to toggle status.";
    return { success: false, error: message };
  }
}

export async function bulkDeleteUsers(
  userIds: string[]
): Promise<ApiResponse<{ deletedCount: number }>> {
  try {
    const session = await auth();
    const callerRoles = session?.user?.roles ?? [];
    const isCallerSuperAdmin = callerRoles.includes("SUPER_ADMIN");
    const callerBrandId = session?.user?.brandId;
    const currentUserId = session?.user?.id;

    if (!isCallerSuperAdmin && !callerRoles.includes("ADMIN")) {
      return {
        success: false,
        error: "No tienes permisos para eliminar usuarios.",
      };
    }

    const filteredIds = userIds.filter((id) => id !== currentUserId);
    if (filteredIds.length === 0) {
      return {
        success: false,
        error: "No se seleccionaron usuarios válidos para eliminar.",
      };
    }

    const targetUsers = await prisma.user.findMany({
      where: { id: { in: filteredIds } },
      include: { roles: { include: { role: true } } },
    });

    const safeIds: string[] = [];
    for (const u of targetUsers) {
      const isSuperAdmin =
        u.roles.some((r) => r.role.name === "SUPER_ADMIN") ||
        u.email === "admin@remotemonkeys.ai";
      if (isSuperAdmin) continue;

      if (!isCallerSuperAdmin && callerBrandId && u.brandId !== callerBrandId) {
        continue;
      }
      safeIds.push(u.id);
    }

    if (safeIds.length === 0) {
      return {
        success: false,
        error: "No se encontraron usuarios que puedas eliminar.",
      };
    }

    const result = await prisma.user.deleteMany({
      where: { id: { in: safeIds } },
    });

    return {
      success: true,
      data: { deletedCount: result.count },
      message: `${result.count} usuarios eliminados correctamente.`,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to delete users.";
    return { success: false, error: message };
  }
}

export async function bulkToggleUsersStatus(
  userIds: string[],
  isActive: boolean
): Promise<ApiResponse<{ updatedCount: number }>> {
  try {
    const session = await auth();
    const callerRoles = session?.user?.roles ?? [];
    const isCallerSuperAdmin = callerRoles.includes("SUPER_ADMIN");
    const callerBrandId = session?.user?.brandId;
    const currentUserId = session?.user?.id;

    if (!isCallerSuperAdmin && !callerRoles.includes("ADMIN")) {
      return {
        success: false,
        error: "No tienes permisos para modificar usuarios.",
      };
    }

    const filteredIds = !isActive
      ? userIds.filter((id) => id !== currentUserId)
      : userIds;

    const targetUsers = await prisma.user.findMany({
      where: { id: { in: filteredIds } },
      include: { roles: { include: { role: true } } },
    });

    const safeIds: string[] = [];
    for (const u of targetUsers) {
      const isSuperAdmin =
        u.roles.some((r) => r.role.name === "SUPER_ADMIN") ||
        u.email === "admin@remotemonkeys.ai";
      if (isSuperAdmin && !isActive) continue;

      if (!isCallerSuperAdmin && callerBrandId && u.brandId !== callerBrandId) {
        continue;
      }
      safeIds.push(u.id);
    }

    if (safeIds.length === 0) {
      return {
        success: false,
        error: "No se encontraron usuarios elegibles para actualizar.",
      };
    }

    const result = await prisma.user.updateMany({
      where: { id: { in: safeIds } },
      data: { isActive },
    });

    return {
      success: true,
      data: { updatedCount: result.count },
      message: `${result.count} usuarios actualizados correctamente.`,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to toggle status.";
    return { success: false, error: message };
  }
}

export async function updateProfile(data: {
  name: string;
  bio?: string;
  locale?: string;
  timezone?: string;
}): Promise<ApiResponse<User>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated." };
    }

    const parsed = updateProfileSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid input.";
      return { success: false, error: firstError };
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: parsed.data,
    });

    const user: User = {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      image: updated.image,
      isActive: updated.isActive,
      bio: updated.bio,
      locale: updated.locale,
      timezone: updated.timezone,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    return { success: true, data: user, message: "Profile updated successfully." };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update profile.";
    return { success: false, error: message };
  }
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<ApiResponse<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated." };
    }

    const parsed = changePasswordSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid input.";
      return { success: false, error: firstError };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.password) {
      return { success: false, error: "User not found." };
    }

    const isValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValid) {
      return { success: false, error: "Incorrect current password." };
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    return { success: true, message: "Password changed successfully." };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to change password.";
    return { success: false, error: message };
  }
}

export async function requestPasswordReset(
  email: string
): Promise<ApiResponse<void>> {
  try {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      return { success: false, error: "Invalid email format." };
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data },
    });

    if (!user) {
      return {
        success: true,
        message: "If an account exists with that email, a reset link has been sent.",
      };
    }

    const token = randomUUID();
    const expires = new Date(Date.now() + 3600000);

    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token,
        expires,
      },
    });

    await sendPasswordResetEmail(user.email, token);

    return {
      success: true,
      message: "If an account exists with that email, a reset link has been sent.",
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to process request.";
    return { success: false, error: message };
  }
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<ApiResponse<void>> {
  try {
    const parsedPassword = passwordSchema.safeParse(newPassword);
    if (!parsedPassword.success) {
      const firstError = parsedPassword.error.issues[0]?.message ?? "Invalid password.";
      return { success: false, error: firstError };
    }

    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken || verificationToken.expires < new Date()) {
      return { success: false, error: "Invalid or expired reset token." };
    }

    const user = await prisma.user.findUnique({
      where: { email: verificationToken.identifier },
    });

    if (!user) {
      return { success: false, error: "User not found." };
    }

    const hashedPassword = await bcrypt.hash(parsedPassword.data, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.verificationToken.delete({
        where: { token },
      }),
    ]);

    return { success: true, message: "Password has been reset successfully." };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to reset password.";
    return { success: false, error: message };
  }
}
