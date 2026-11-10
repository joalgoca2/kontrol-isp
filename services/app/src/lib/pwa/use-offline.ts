"use client";

import { useState, useEffect, useCallback } from "react";
import { FEATURES } from "@/lib/config/features";
import {
  getPendingActions,
  removePendingAction,
  type PendingOfflineAction,
} from "./offline-db";

export function useOffline() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshPendingCount = useCallback(async () => {
    if (!FEATURES.pwa) return;
    try {
      const actions = await getPendingActions();
      setPendingCount(actions.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const syncPendingQueue = useCallback(async () => {
    if (!FEATURES.pwa || isSyncing) return;

    setIsSyncing(true);
    try {
      const actions = await getPendingActions();

      for (const action of actions) {
        await processSingleOfflineAction(action);
        await removePendingAction(action.id);
      }

      await refreshPendingCount();
    } catch {
      // Error processing offline queue
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  useEffect(() => {
    if (typeof window === "undefined" || !FEATURES.pwa) return;

    setIsOnline(navigator.onLine);
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      syncPendingQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshPendingCount, syncPendingQueue]);

  return {
    isOnline: !FEATURES.pwa || isOnline,
    pendingCount,
    isSyncing,
    refreshPendingCount,
    syncPendingQueue,
  };
}

async function processSingleOfflineAction(
  _action: PendingOfflineAction
): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300));
}
