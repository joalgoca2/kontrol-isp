"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { getBrands } from "@/actions/brands";
import type { Brand } from "@/types";

export const BRAND_MANDATORY_ROUTES: string[] = [
  "/dashboard/network-map",
  "/dashboard/whatsapp-chat",
  "/dashboard/settings/ai",
  "/dashboard/nodes",
  "/dashboard/plans",
  "/dashboard/clients",
  "/dashboard/contracts",
  "/dashboard/billing",
  "/dashboard/tickets",
];

export function isBrandMandatoryRoute(pathname: string): boolean {
  return BRAND_MANDATORY_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
}

interface BrandContextType {
  activeBrandId: string;
  setActiveBrandId: (id: string) => void;
  brands: Brand[];
  activeBrand: Brand | null;
  isSuperAdmin: boolean;
  isLoading: boolean;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

const COOKIE_NAME = "kontrol_active_brand_id";

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escapedName = name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1");
  const regex = new RegExp("(?:^|; )" + escapedName + "=([^;]*)");
  const match = document.cookie.match(regex);
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookieValue(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const cookieStr =
    `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
  document.cookie = cookieStr;
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isSuperAdmin = Boolean(session?.user?.roles?.includes("SUPER_ADMIN"));
  const userBrandId = session?.user?.brandId ?? null;

  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrandId, setActiveBrandIdState] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setActiveBrandId = useCallback(
    (id: string) => {
      const nextId = isSuperAdmin ? id : (userBrandId ?? "ALL");
      setActiveBrandIdState(nextId);
      setCookieValue(COOKIE_NAME, nextId);
    },
    [isSuperAdmin, userBrandId]
  );

  useEffect(() => {
    let isMounted = true;
    async function loadBrands() {
      try {
        const res = await getBrands();
        if (isMounted && res.success && res.data) {
          setBrands(res.data);
        }
      } catch (_err) {
        // Ignorado
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadBrands();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSuperAdmin && userBrandId) {
      setActiveBrandIdState(userBrandId);
      setCookieValue(COOKIE_NAME, userBrandId);
    } else if (isSuperAdmin) {
      const savedCookie = getCookieValue(COOKIE_NAME);
      if (savedCookie) {
        setActiveBrandIdState(savedCookie);
      } else {
        setActiveBrandIdState("ALL");
      }
    }
  }, [isSuperAdmin, userBrandId]);

  // Intelligent auto-selection when entering operational routes
  useEffect(() => {
    if (isLoading || brands.length === 0) return;

    if (isBrandMandatoryRoute(pathname) && activeBrandId === "ALL") {
      const firstBrandId = brands[0]?.id;
      if (firstBrandId) {
        setActiveBrandIdState(firstBrandId);
        setCookieValue(COOKIE_NAME, firstBrandId);
      }
    }
  }, [pathname, activeBrandId, brands, isLoading]);

  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? null;

  return (
    <BrandContext.Provider
      value={{
        activeBrandId,
        setActiveBrandId,
        brands,
        activeBrand,
        isSuperAdmin,
        isLoading,
      }}
    >
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand(): BrandContextType {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error("useBrand debe usarse dentro de un BrandProvider");
  }
  return context;
}
