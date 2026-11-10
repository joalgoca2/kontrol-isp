export type RoleName =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "TECHNICIAN"
  | "BILLING"
  | "SUPPORT";

export const ROLE_NAMES: readonly RoleName[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "TECHNICIAN",
  "BILLING",
  "SUPPORT",
] as const;

export interface User {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  isActive: boolean;
  bio?: string | null;
  locale: string;
  timezone: string;
  brandId?: string | null;
  brand?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  roles?: string[];
  permissions?: string[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface UserWithRoles extends User {
  roles?: string[];
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Permission {
  id: string;
  name: string;
  description?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface LoginHistoryItem {
  id: string;
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
  device?: string | null;
  browser?: string | null;
  createdAt: string | Date;
}
