export interface PendingOfflineAction {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
  createdAt: number;
  status: "PENDING" | "SYNCING" | "FAILED";
  retryCount: number;
}

const DB_NAME = "kontrolOfflineDB";
const STORE_NAME = "pending_actions";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addPendingAction(
  actionType: string,
  payload: Record<string, unknown>
): Promise<PendingOfflineAction> {
  const db = await openDB();
  const action: PendingOfflineAction = {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    actionType,
    payload,
    createdAt: Date.now(),
    status: "PENDING",
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(action);

    request.onsuccess = () => resolve(action);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingActions(): Promise<PendingOfflineAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = (request.result as PendingOfflineAction[]) || [];
      resolve(all.filter((a) => a.status === "PENDING"));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingAction(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllPendingActions(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
