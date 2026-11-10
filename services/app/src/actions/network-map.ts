"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocoding";
import { executeOnNode } from "@/lib/mikrotik/node-manager";
import { resolveTenantBrand } from "@/lib/tenant";
import type { ApiResponse } from "@/types";

export interface MapPoint {
  id: string;
  contractNumber: string;
  clientCode?: string | null;
  pppoeUser: string;
  clientName: string;
  clientDoc: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  billingStatus: string;
  serviceStatus: string;
  technology: string;
  nodeId: string;
  nodeName: string;
  nodeCode: string;
  planName: string;
  planSpeed: string;
  equipment?: {
    routerBrand?: string | null;
    routerModel?: string | null;
    routerMac?: string | null;
    antennaType?: string | null;
    opticalPowerRx?: number | null;
  } | null;
}

export interface NetworkMapResponse {
  points: MapPoint[];
  totalWithCoords: number;
  totalWithoutCoords: number;
  onlineCount: number;
  offlineCount: number;
  suspendedCount: number;
  nodes: Array<{ id: string; name: string; code: string }>;
}

export async function getNetworkMapPoints(
  brandId?: string
): Promise<ApiResponse<NetworkMapResponse>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const { brandFilter } = resolveTenantBrand(session, brandId);

    const [contractsWithCoords, totalWithoutCoords, activeNodes] = await Promise.all([
      prisma.contract.findMany({
        where: {
          ...brandFilter,
          latitude: { not: null },
          longitude: { not: null },
        },
        include: {
          client: true,
          node: true,
          plan: true,
          equipment: true,
        },
        take: 3000,
      }),
      prisma.contract.count({
        where: {
          ...brandFilter,
          OR: [{ latitude: null }, { longitude: null }],
        },
      }),
      prisma.mikrotikNode.findMany({
        where: {
          ...brandFilter,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          code: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    let onlineCount = 0;
    let offlineCount = 0;
    let suspendedCount = 0;

    const points: MapPoint[] = contractsWithCoords.map((c) => {
      const isOnline = c.serviceStatus === "ONLINE";
      const isSuspended = c.billingStatus === "SUSPENDIDO_MORA";

      if (isSuspended) {
        suspendedCount++;
      } else if (isOnline) {
        onlineCount++;
      } else {
        offlineCount++;
      }

      return {
        id: c.id,
        contractNumber: c.contractNumber,
        clientCode: c.client?.clientCode ?? null,
        pppoeUser: c.pppoeUser,
        clientName: c.client?.fullName || "Cliente Desconocido",
        clientDoc: `${c.client?.documentType || "CC"} ${c.client?.documentNumber || ""}`.trim(),
        address: c.address,
        city: c.city,
        latitude: c.latitude as number,
        longitude: c.longitude as number,
        billingStatus: c.billingStatus,
        serviceStatus: c.serviceStatus,
        technology: c.technology,
        nodeId: c.nodeId || "none",
        nodeName: c.node?.name || "Sin nodo",
        nodeCode: c.node?.code || "N/D",
        planName: c.plan?.name || "Sin plan",
        planSpeed: c.plan?.rateLimit || "N/D",
        equipment: c.equipment
          ? {
              routerBrand: c.equipment.routerBrand,
              routerModel: c.equipment.routerModel,
              routerMac: c.equipment.routerMac,
              antennaType: c.equipment.antennaType,
              opticalPowerRx: c.equipment.opticalPowerRx,
            }
          : null,
      };
    });

    return {
      success: true,
      data: {
        points,
        totalWithCoords: points.length,
        totalWithoutCoords,
        onlineCount,
        offlineCount,
        suspendedCount,
        nodes: activeNodes,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener mapa de red.";
    return { success: false, error: message };
  }
}

export interface GeocodingWorkerState {
  isRunning: boolean;
  startedAt: number | null;
  processed: number;
  totalRemaining: number;
  brandId?: string | null;
  lastError?: string | null;
}

const globalWorker = globalThis as unknown as {
  __geocodingWorker?: GeocodingWorkerState;
};

if (!globalWorker.__geocodingWorker) {
  globalWorker.__geocodingWorker = {
    isRunning: false,
    startedAt: null,
    processed: 0,
    totalRemaining: 0,
    brandId: null,
    lastError: null,
  };
}

function checkAndResetWorkerLock(): boolean {
  const worker = globalWorker.__geocodingWorker;
  if (!worker) return false;
  // Auto-release lock if it runs for over 5 minutes (safety watchdog)
  if (
    worker.isRunning &&
    worker.startedAt &&
    Date.now() - worker.startedAt > 300000
  ) {
    worker.isRunning = false;
    worker.startedAt = null;
  }
  return worker.isRunning;
}

async function runBackgroundGeocodingJob(
  targetBrandId: string | null | undefined,
  isAllBrands: boolean,
  batchSize: number,
  actor: string | null
): Promise<void> {
  const worker = globalWorker.__geocodingWorker!;
  try {
    const brandFilter = isAllBrands ? {} : { brandId: targetBrandId ?? "none" };
    const limit = Math.min(50, Math.max(1, batchSize));
    const validBrandId = isAllBrands ? null : (targetBrandId ?? null);

    const orderedRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT ct."id"
      FROM "contracts" ct
      INNER JOIN "clients" c ON c."id" = ct."clientId"
      WHERE (
        ${validBrandId}::text IS NULL OR ct."brandId" = ${validBrandId}
      ) AND (
        ct."latitude" IS NULL OR ct."longitude" IS NULL
      )
      ORDER BY
        CASE
          WHEN ct."serviceStatus" = 'ONLINE' THEN 1
          WHEN ct."billingStatus" = 'ACTIVO' THEN 2
          WHEN ct."billingStatus" = 'CORTESIA' THEN 3
          WHEN ct."billingStatus" = 'AVISO_VENCIMIENTO' THEN 4
          WHEN ct."billingStatus" = 'SUSPENDIDO_MORA' THEN 5
          WHEN ct."billingStatus" = 'RETIRADO' THEN 6
          ELSE 7
        END ASC,
        NULLIF(
          regexp_replace(c."client_code", '\\D', '', 'g'),
          ''
        )::BIGINT ASC NULLS LAST,
        ct."id" ASC
      LIMIT ${limit}
    `;

    if (orderedRows.length === 0) {
      worker.isRunning = false;
      worker.totalRemaining = 0;
      return;
    }

    const targetIds = orderedRows.map((r) => r.id);
    const pendingContracts = await prisma.contract.findMany({
      where: { id: { in: targetIds } },
      select: {
        id: true,
        address: true,
        city: true,
      },
    });

    const pendingMap = new Map(pendingContracts.map((p) => [p.id, p]));
    const pending = targetIds
      .map((id) => pendingMap.get(id))
      .filter((p): p is (typeof pendingContracts)[number] => Boolean(p));

    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    for (const contract of pending) {
      const geo = await geocodeAddress(
        contract.address,
        contract.city || "Soacha",
        googleKey
      );

      if (geo) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            latitude: geo.latitude,
            longitude: geo.longitude,
            updatedBy: actor,
          },
        });
      } else {
        const defaultLat = 4.5826 + (Math.random() - 0.5) * 0.03;
        const defaultLon = -74.2117 + (Math.random() - 0.5) * 0.03;
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            latitude: defaultLat,
            longitude: defaultLon,
            updatedBy: actor,
          },
        });
      }

      worker.processed++;
      // Controlled polite pacing
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    const remaining = await prisma.contract.count({
      where: {
        ...brandFilter,
        OR: [{ latitude: null }, { longitude: null }],
      },
    });

    worker.totalRemaining = remaining;
  } catch (err: unknown) {
    worker.lastError =
      err instanceof Error ? err.message : "Error durante geocodificación";
  } finally {
    worker.isRunning = false;
    worker.startedAt = null;
  }
}

export async function startBackgroundGeocoding(
  brandId?: string,
  batchSize = 25
): Promise<
  ApiResponse<{
    status: "started" | "already_running";
    remaining: number;
    processed: number;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const isRunning = checkAndResetWorkerLock();

    const { brandFilter, targetBrandId, isSuperAdmin } =
      resolveTenantBrand(session, brandId);

    const remaining = await prisma.contract.count({
      where: {
        ...brandFilter,
        OR: [{ latitude: null }, { longitude: null }],
      },
    });

    if (isRunning) {
      return {
        success: true,
        data: {
          status: "already_running",
          remaining,
          processed: globalWorker.__geocodingWorker?.processed ?? 0,
        },
      };
    }

    if (remaining === 0) {
      return {
        success: true,
        data: {
          status: "started",
          remaining: 0,
          processed: 0,
        },
      };
    }

    // Set singleton lock
    const worker = globalWorker.__geocodingWorker!;
    worker.isRunning = true;
    worker.startedAt = Date.now();
    worker.processed = 0;
    worker.totalRemaining = remaining;
    worker.brandId = targetBrandId ?? null;
    worker.lastError = null;

    const actor = session.user.email ?? null;

    // Fire and forget (detached promise)
    runBackgroundGeocodingJob(
      targetBrandId,
      isSuperAdmin && (!brandId || brandId === "ALL"),
      batchSize,
      actor
    ).catch((err: unknown) => {
      worker.isRunning = false;
      worker.lastError =
        err instanceof Error ? err.message : "Error en worker";
    });

    return {
      success: true,
      data: {
        status: "started",
        remaining,
        processed: 0,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al iniciar geocodificación.";
    return { success: false, error: message };
  }
}

export async function getGeocodingStatus(): Promise<
  ApiResponse<GeocodingWorkerState>
> {
  try {
    checkAndResetWorkerLock();
    const worker = globalWorker.__geocodingWorker!;
    return {
      success: true,
      data: { ...worker },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error al consultar estado de geocodificación.",
    };
  }
}

// Backward-compatible wrapper
export async function geocodePendingBatch(
  batchSize = 25,
  brandId?: string
): Promise<
  ApiResponse<{ processed: number; successCount: number; remaining: number }>
> {
  const res = await startBackgroundGeocoding(brandId, batchSize);
  if (!res.success || !res.data) {
    return { success: false, error: res.error || "Error al geocodificar." };
  }
  return {
    success: true,
    data: {
      processed: res.data.processed,
      successCount: res.data.processed,
      remaining: res.data.remaining,
    },
  };
}

export interface SyncAllNetworkResult {
  totalActiveInRouter: number;
  matchedCount: number;
  onlineCount: number;
  offlineCount: number;
}

export async function syncAllNetworkStatus(
  brandId?: string
): Promise<ApiResponse<SyncAllNetworkResult>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const { brandFilter } = resolveTenantBrand(session, brandId);

    const activeNodes = await prisma.mikrotikNode.findMany({
      where: {
        ...brandFilter,
        isActive: true,
      },
    });

    if (activeNodes.length === 0) {
      return {
        success: false,
        error: "No se encontraron nodos MikroTik activos para sincronizar.",
      };
    }

    const actor = session.user.email ?? null;

    interface ActiveSessionEntry {
      ip: string;
      mac?: string;
      originalName: string;
    }

    const activeSessionsMap = new Map<string, ActiveSessionEntry>();
    const activeIpMap = new Map<string, ActiveSessionEntry>();
    let totalActiveInRouter = 0;

    for (const node of activeNodes) {
      const res = await executeOnNode(node, async (client) => {
        const activeRes = await client.executeSentence(["/ppp/active/print"]);
        return activeRes.sentences;
      });

      if (res.success && res.data) {
        totalActiveInRouter += res.data.length;
        for (const item of res.data) {
          const userName = (item.name || "").trim();
          const ipAddr = (item.address || "").trim();
          const macAddr = (item["caller-id"] || "").trim();
          if (userName) {
            const entry: ActiveSessionEntry = {
              ip: ipAddr,
              mac: macAddr || undefined,
              originalName: userName,
            };
            activeSessionsMap.set(userName.toLowerCase(), entry);
            if (ipAddr) {
              activeIpMap.set(ipAddr, entry);
            }
          }
        }
      }
    }

    const contracts = await prisma.contract.findMany({
      where: brandFilter,
      select: {
        id: true,
        pppoeUser: true,
        ipAddress: true,
        macAddress: true,
        serviceStatus: true,
      },
    });

    const onlineContractIds: string[] = [];
    const updatesToPerform: Array<{
      id: string;
      ipAddress?: string;
      macAddress?: string;
    }> = [];

    for (const contract of contracts) {
      const userKey = (contract.pppoeUser || "").trim().toLowerCase();
      const ipKey = (contract.ipAddress || "").trim();

      const matched =
        activeSessionsMap.get(userKey) ||
        (ipKey ? activeIpMap.get(ipKey) : undefined);

      if (matched) {
        onlineContractIds.push(contract.id);
        const needsIp = matched.ip && contract.ipAddress !== matched.ip;
        const needsMac = matched.mac && contract.macAddress !== matched.mac;

        if (needsIp || needsMac) {
          updatesToPerform.push({
            id: contract.id,
            ipAddress: matched.ip || undefined,
            macAddress: matched.mac || undefined,
          });
        }
      }
    }

    // 1. Batch set matched contracts to ONLINE
    if (onlineContractIds.length > 0) {
      await prisma.contract.updateMany({
        where: { id: { in: onlineContractIds } },
        data: {
          serviceStatus: "ONLINE",
          updatedAt: new Date(),
          updatedBy: actor,
        },
      });
    }

    // 2. Perform individual telemetry field updates (IP, MAC)
    for (const item of updatesToPerform) {
      await prisma.contract.update({
        where: { id: item.id },
        data: {
          ...(item.ipAddress ? { ipAddress: item.ipAddress } : {}),
          ...(item.macAddress ? { macAddress: item.macAddress } : {}),
          updatedAt: new Date(),
          updatedBy: actor,
        },
      });

      if (item.macAddress) {
        await prisma.contractEquipment.upsert({
          where: { contractId: item.id },
          create: {
            contractId: item.id,
            routerMac: item.macAddress,
          },
          update: {
            routerMac: item.macAddress,
          },
        });
      }
    }

    // 3. Batch set all non-matched contracts to OFFLINE
    await prisma.contract.updateMany({
      where: {
        ...brandFilter,
        id: { notIn: onlineContractIds },
        serviceStatus: { not: "OFFLINE" },
      },
      data: {
        serviceStatus: "OFFLINE",
        updatedAt: new Date(),
        updatedBy: actor,
      },
    });

    return {
      success: true,
      data: {
        totalActiveInRouter,
        matchedCount: onlineContractIds.length,
        onlineCount: onlineContractIds.length,
        offlineCount: contracts.length - onlineContractIds.length,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al sincronizar estado de red masivo.";
    return { success: false, error: message };
  }
}


