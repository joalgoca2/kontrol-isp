import type { RoleName } from "@/types";

export interface RouteConfig {
  path: string;
  allowedRoles: RoleName[];
  exact?: boolean;
}

/**
 * Centralized Route Permission Registry (Single Source of Truth)
 */
export const ROUTE_PERMISSIONS: RouteConfig[] = [
  {
    path: "/dashboard/brands",
    allowedRoles: ["SUPER_ADMIN"],
  },
  {
    path: "/dashboard/users",
    allowedRoles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    path: "/dashboard/settings",
    allowedRoles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    path: "/dashboard/nodes",
    allowedRoles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    path: "/dashboard/network-map",
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "TECHNICIAN", "SUPPORT"],
  },
  {
    path: "/dashboard/plans",
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "BILLING"],
  },
  {
    path: "/dashboard/clients",
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "BILLING", "SUPPORT", "TECHNICIAN"],
  },
  {
    path: "/dashboard/contracts",
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "BILLING", "SUPPORT", "TECHNICIAN"],
  },
  {
    path: "/dashboard/billing",
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "BILLING"],
  },
  {
    path: "/dashboard/tickets",
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "BILLING", "TECHNICIAN", "SUPPORT"],
  },
  {
    path: "/dashboard/whatsapp-chat",
    allowedRoles: ["SUPER_ADMIN", "ADMIN", "BILLING", "SUPPORT"],
  },
];

/**
 * Helper to check if user roles permit access to a route.
 */
export function hasRouteAccess(pathname: string, userRoles: string[]): boolean {
  if (!pathname.startsWith("/dashboard")) {
    return true;
  }

  // Exact dashboard root is accessible to any authenticated user with a role
  if (pathname === "/dashboard") {
    return userRoles.length > 0;
  }

  const matchedRoute = ROUTE_PERMISSIONS.find((route) =>
    route.exact ? pathname === route.path : pathname.startsWith(route.path)
  );

  if (!matchedRoute) {
    return true;
  }

  return userRoles.some((role) =>
    matchedRoute.allowedRoles.includes(role as RoleName)
  );
}

/**
 * Checks if a session user has a specific granular permission from the database.
 * SuperAdmin automatically bypasses all permission checks.
 */
export function hasPermission(
  user: { roles?: string[]; permissions?: string[] } | null | undefined,
  requiredPermission: string
): boolean {
  if (!user) return false;
  const roles = user.roles ?? [];
  if (roles.includes("SUPER_ADMIN")) return true;
  const permissions = user.permissions ?? [];
  return permissions.includes(requiredPermission);
}
