import type { Session } from "next-auth";

export interface TenantResolution {
  isSuperAdmin: boolean;
  targetBrandId: string | null;
  brandFilter: { brandId?: string };
}

/**
 * Resolves multi-tenant brand isolation parameters based on user session roles
 * and optional requested brand ID from UI selectors.
 *
 * Rules:
 * - SUPER_ADMIN with "ALL" or omitted brandId has global visibility (empty filter).
 * - SUPER_ADMIN with a specific brandId filters by that brand.
 * - Standard users / admins are strictly restricted to their own session.user.brandId.
 */
export function resolveTenantBrand(
  session: Session | null | undefined,
  requestedBrandId?: string | null
): TenantResolution {
  const roles = session?.user?.roles ?? [];
  const isSuperAdmin = Boolean(roles.includes("SUPER_ADMIN"));
  const sessionBrandId = session?.user?.brandId ?? null;

  const targetBrandId =
    isSuperAdmin && requestedBrandId && requestedBrandId !== "ALL"
      ? requestedBrandId
      : sessionBrandId;

  const isGlobalView =
    isSuperAdmin && (!requestedBrandId || requestedBrandId === "ALL");

  const brandFilter = isGlobalView
    ? {}
    : { brandId: targetBrandId ?? "none" };

  return {
    isSuperAdmin,
    targetBrandId,
    brandFilter,
  };
}
