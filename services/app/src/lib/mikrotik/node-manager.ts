import { RouterosClient } from "./routeros-client";
import { decryptSecret } from "@/lib/crypto";
import type {
  MikrotikNode,
  MikrotikActiveSession,
  MikrotikLiveDiagnostic,
  MikrotikSecret,
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
      try {
        const result = await callback(client);
        return { success: true, data: result, usedFallback: false };
      } catch (callbackErr: unknown) {
        const msg =
          callbackErr instanceof Error
            ? callbackErr.message
            : String(callbackErr);
        return { success: false, error: msg, usedFallback: false };
      }
    }
  } catch (_primaryErr) {
    // Primary connection failed, proceed to fallback if available
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
        try {
          const result = await callback(client);
          return { success: true, data: result, usedFallback: true };
        } catch (fallbackExecErr: unknown) {
          const msg =
            fallbackExecErr instanceof Error
              ? fallbackExecErr.message
              : String(fallbackExecErr);
          return { success: false, error: msg, usedFallback: true };
        }
      }
    } catch (_fallbackErr) {
      // Fallback connection also failed
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
    error: formatMikrotikError(res.error),
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
    error: formatMikrotikError(res.error),
  };
}

export function formatMikrotikError(err?: string): string {
  if (!err) return "Error desconocido en RouterOS.";
  const lower = err.toLowerCase();
  if (
    lower.includes("not permitted") ||
    lower.includes("permission") ||
    lower.includes("access denied") ||
    lower.includes("cannot change") ||
    lower.includes("not enough permissions")
  ) {
    return (
      "Permiso denegado en MikroTik: El usuario configurado en el nodo tiene " +
      "permisos de solo lectura ('read'). Se requieren permisos de escritura ('write') " +
      "en RouterOS para suspender, reactivar o reiniciar sesiones PPPoE."
    );
  }
  return err;
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
    if (findRes.trap) {
      throw new Error(findRes.error || "action not permitted");
    }
    const active = findRes.sentences[0];
    if (active && active[".id"]) {
      const removeRes = await client.executeSentence([
        "/ppp/active/remove",
        `=.id=${active[".id"]}`,
      ]);
      if (removeRes.trap) {
        throw new Error(removeRes.error || "action not permitted");
      }
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
    message: formatMikrotikError(res.error),
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
    if (findRes.trap) {
      throw new Error(findRes.error || "action not permitted");
    }
    const secret = findRes.sentences[0];
    if (secret && secret[".id"]) {
      const setRes = await client.executeSentence([
        "/ppp/secret/set",
        `=.id=${secret[".id"]}`,
        `=disabled=${suspend ? "yes" : "no"}`,
      ]);
      if (setRes.trap) {
        throw new Error(setRes.error || "action not permitted");
      }

      if (suspend) {
        const activeRes = await client.executeSentence([
          "/ppp/active/print",
          `?name=${pppoeUser}`,
        ]);
        if (activeRes.trap) {
          throw new Error(activeRes.error || "action not permitted");
        }
        const active = activeRes.sentences[0];
        if (active && active[".id"]) {
          const removeRes = await client.executeSentence([
            "/ppp/active/remove",
            `=.id=${active[".id"]}`,
          ]);
          if (removeRes.trap) {
            throw new Error(removeRes.error || "action not permitted");
          }
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
    message: formatMikrotikError(res.error),
  };
}

export async function getNodeAllSecrets(
  node: MikrotikNode
): Promise<{ success: boolean; secrets?: MikrotikSecret[]; error?: string }> {
  const res = await executeOnNode(node, async (client) => {
    const queryRes = await client.executeSentence(["/ppp/secret/print"]);
    if (queryRes.trap) {
      throw new Error(queryRes.error || "failed to fetch secrets");
    }
    return queryRes.sentences.map((s) => ({
      id: s[".id"] ?? "",
      name: s.name ?? "",
      service: s.service,
      profile: s.profile,
      disabled: s.disabled === "true",
      comment: s.comment,
      remoteAddress: s["remote-address"],
      lastCallerId: s["last-caller-id"],
      lastLoggedOut:
        s["last-logged-out"] && s["last-logged-out"] !== "1970-01-01 00:00:00"
          ? s["last-logged-out"]
          : undefined,
      lastDisconnectReason: s["last-disconnect-reason"],
    }));
  });

  if (res.success && res.data) {
    return { success: true, secrets: res.data };
  }
  return { success: false, error: formatMikrotikError(res.error) };
}

export async function createPppSecretOnRouter(
  node: MikrotikNode,
  data: {
    name: string;
    password?: string;
    profile?: string;
    comment?: string;
    remoteAddress?: string;
  }
): Promise<{ success: boolean; message: string }> {
  const sentence = [
    "/ppp/secret/add",
    `=name=${data.name}`,
    `=service=pppoe`,
  ];
  if (data.password) {
    sentence.push(`=password=${data.password}`);
  }
  if (data.profile) {
    sentence.push(`=profile=${data.profile}`);
  }
  if (data.comment) {
    sentence.push(`=comment=${data.comment}`);
  }
  if (data.remoteAddress) {
    sentence.push(`=remote-address=${data.remoteAddress}`);
  }

  const res = await executeOnNode(node, async (client) => {
    const addRes = await client.executeSentence(sentence);
    if (addRes.trap) {
      throw new Error(addRes.error || "failed to add secret");
    }
    return true;
  });

  if (res.success) {
    return {
      success: true,
      message: `Cuenta PPPoE '${data.name}' creada exitosamente en MikroTik.`,
    };
  }

  return {
    success: false,
    message: formatMikrotikError(res.error),
  };
}
