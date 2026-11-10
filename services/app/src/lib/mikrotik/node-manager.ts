import { RouterosClient } from "./routeros-client";
import { decryptSecret } from "@/lib/crypto";
import type {
  MikrotikNode,
  MikrotikActiveSession,
  MikrotikLiveDiagnostic,
} from "@/types";

export interface NodeHealthResult {
  connected: boolean;
  latencyMs: number;
  cpuUsage?: number;
  activeSessions: number;
  version?: string;
  uptime?: string;
  error?: string;
}

export async function executeOnNode<T>(
  node: Pick<
    MikrotikNode,
    "host" | "port" | "username" | "passwordEncrypted" | "fallbackHost" | "useTls"
  >,
  callback: (client: RouterosClient) => Promise<T>
): Promise<{ success: boolean; data?: T; error?: string; usedFallback?: boolean }> {
  const plainPassword = decryptSecret(node.passwordEncrypted);

  // 1. Try Primary Host
  let client = new RouterosClient({
    host: node.host,
    port: node.port,
    username: node.username,
    password: plainPassword,
    useTls: node.useTls,
    timeoutMs: 3000,
  });

  try {
    const ok = await client.connect();
    if (ok) {
      const result = await callback(client);
      return { success: true, data: result, usedFallback: false };
    }
  } catch (_primaryErr) {
    // Primary failed, proceed to fallback if available
  } finally {
    client.disconnect();
  }

  // 2. Try Fallback Host (e.g. internal LAN IP)
  if (node.fallbackHost && node.fallbackHost !== node.host) {
    client = new RouterosClient({
      host: node.fallbackHost,
      port: node.port,
      username: node.username,
      password: plainPassword,
      useTls: node.useTls,
      timeoutMs: 3000,
    });

    try {
      const ok = await client.connect();
      if (ok) {
        const result = await callback(client);
        return { success: true, data: result, usedFallback: true };
      }
    } catch (_fallbackErr) {
      // Fallback also failed
    } finally {
      client.disconnect();
    }
  }

  return {
    success: false,
    error: `No se pudo conectar al nodo MikroTik (${node.host}:${node.port})`,
  };
}

export async function testNodeHealth(
  node: MikrotikNode
): Promise<NodeHealthResult> {
  const start = Date.now();

  const res = await executeOnNode(node, async (client) => {
    const resourceRes = await client.executeSentence([
      "/system/resource/print",
    ]);
    const resource = resourceRes.sentences[0] || {};

    const activeRes = await client.executeSentence([
      "/ppp/active/print",
      "=count-only=",
    ]);
    const activeCount = parseInt(activeRes.sentences[0]?.ret || "0", 10);

    const boardName = resource["board-name"];
    const rosVersion = resource.version;
    const formattedVersion =
      boardName && rosVersion
        ? `${boardName} · v${rosVersion}`
        : rosVersion || boardName;

    return {
      cpuUsage: resource["cpu-load"]
        ? parseInt(resource["cpu-load"], 10)
        : undefined,
      version: formattedVersion,
      uptime: resource.uptime,
      activeSessions: isNaN(activeCount) ? 0 : activeCount,
    };
  });

  const latencyMs = Date.now() - start;

  if (res.success && res.data) {
    return {
      connected: true,
      latencyMs,
      cpuUsage: res.data.cpuUsage,
      activeSessions: res.data.activeSessions,
      version: res.data.version,
      uptime: res.data.uptime,
    };
  }

  return {
    connected: false,
    latencyMs,
    activeSessions: 0,
    error: res.error,
  };
}

export async function getClientPppSession(
  node: MikrotikNode,
  pppoeUser: string,
  fallbackIp?: string | null
): Promise<MikrotikLiveDiagnostic> {
  const start = Date.now();
  const res = await executeOnNode(node, async (client) => {
    const queryRes = await client.executeSentence([
      "/ppp/active/print",
      `?name=${pppoeUser}`,
    ]);
    const secretRes = await client.executeSentence([
      "/ppp/secret/print",
      `?name=${pppoeUser}`,
    ]);

    const active = queryRes.sentences[0];
    const secret = secretRes.sentences[0];

    let session: MikrotikActiveSession | null = null;
    if (active && active[".id"]) {
      session = {
        id: active[".id"],
        name: active.name || pppoeUser,
        service: active.service || "pppoe",
        callerId: active["caller-id"],
        address: active.address || fallbackIp || "0.0.0.0",
        uptime: active.uptime || "0s",
        sessionId: active["session-id"],
      };
    }

    const secretFound = Boolean(secret && secret[".id"]);
    const rawLastLogout = secret?.["last-logged-out"];
    const validLastLogout =
      rawLastLogout && rawLastLogout !== "1970-01-01 00:00:00"
        ? rawLastLogout
        : null;

    return {
      session,
      secretFound,
      secretDisabled: secret?.disabled === "true",
      secretProfile: secret?.profile ?? null,
      secretRemoteAddress: secret?.["remote-address"] ?? null,
      lastLoggedOut: validLastLogout,
      lastCallerId: secret?.["last-caller-id"] || null,
      lastDisconnectReason: secret?.["last-disconnect-reason"] || null,
    };
  });

  const latencyMs = Date.now() - start;

  if (res.success && res.data) {
    return {
      connected: true,
      targetHost: res.usedFallback
        ? (node.fallbackHost ?? node.host)
        : node.host,
      targetPort: node.port,
      sessionFound: Boolean(res.data.session),
      session: res.data.session,
      secretFound: res.data.secretFound,
      secretDisabled: res.data.secretDisabled,
      secretProfile: res.data.secretProfile,
      secretRemoteAddress: res.data.secretRemoteAddress,
      lastLoggedOut: res.data.lastLoggedOut,
      lastCallerId: res.data.lastCallerId,
      lastDisconnectReason: res.data.lastDisconnectReason,
      latencyMs,
    };
  }

  return {
    connected: false,
    targetHost: node.host,
    targetPort: node.port,
    sessionFound: false,
    error: res.error,
  };
}

export async function kickClientSession(
  node: MikrotikNode,
  pppoeUser: string
): Promise<{ success: boolean; message: string }> {
  const res = await executeOnNode(node, async (client) => {
    const findRes = await client.executeSentence([
      "/ppp/active/print",
      `?name=${pppoeUser}`,
    ]);
    const active = findRes.sentences[0];
    if (active && active[".id"]) {
      await client.executeSentence([
        "/ppp/active/remove",
        `=.id=${active[".id"]}`,
      ]);
      return true;
    }
    return false;
  });

  if (res.success) {
    return {
      success: true,
      message: res.data
        ? `Sesión PPPoE de '${pppoeUser}' reiniciada exitosamente en router.`
        : `No se encontró sesión activa para '${pppoeUser}' en router.`,
    };
  }

  return {
    success: false,
    message:
      res.error ||
      `No se pudo reiniciar la sesión de '${pppoeUser}' en el router.`,
  };
}

export async function setClientSuspensionOnRouter(
  node: MikrotikNode,
  pppoeUser: string,
  suspend: boolean
): Promise<{ success: boolean; message: string }> {
  const res = await executeOnNode(node, async (client) => {
    const findRes = await client.executeSentence([
      "/ppp/secret/print",
      `?name=${pppoeUser}`,
    ]);
    const secret = findRes.sentences[0];
    if (secret && secret[".id"]) {
      await client.executeSentence([
        "/ppp/secret/set",
        `=.id=${secret[".id"]}`,
        `=disabled=${suspend ? "yes" : "no"}`,
      ]);

      if (suspend) {
        const activeRes = await client.executeSentence([
          "/ppp/active/print",
          `?name=${pppoeUser}`,
        ]);
        const active = activeRes.sentences[0];
        if (active && active[".id"]) {
          await client.executeSentence([
            "/ppp/active/remove",
            `=.id=${active[".id"]}`,
          ]);
        }
      }
      return true;
    }
    return false;
  });

  if (res.success) {
    return {
      success: true,
      message: suspend
        ? `Abonado '${pppoeUser}' suspendido en MikroTik.`
        : `Abonado '${pppoeUser}' reactivado en MikroTik.`,
    };
  }

  return {
    success: false,
    message:
      res.error ||
      `No se pudo actualizar el estado de '${pppoeUser}' en el router.`,
  };
}
