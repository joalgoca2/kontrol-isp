export interface SendWhatsappReceiptParams {
  recipientPhone: string;
  clientName?: string;
  studentName?: string;
  receiptNumber: number | string;
  brandName?: string;
  conceptType?: string;
  conceptDescription?: string;
  periodBilled?: string;
  currency?: "COP" | "USD";
  amount?: number;
  exchangeRate?: number;
  amountCop?: number;
  paymentMethod: string;
  recordedBy?: string;
  createdAt?: Date | string;
}

export interface EvolutionApiResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

export function getEvolutionConfig(
  overrideInstanceName?: string
): EvolutionConfig {
  const baseUrl = (
    process.env.EVOLUTION_API_URL ||
    process.env.EVOLUTION_BASE_URL ||
    "http://localhost:8080"
  ).replace(/\/+$/, "");

  const apiKey = (
    process.env.EVOLUTION_API_KEY ||
    process.env.EVOLUTION_KEY ||
    ""
  ).trim();

  const instanceName = (overrideInstanceName || "serkoi-telecom").trim();

  return { baseUrl, apiKey, instanceName };
}

/**
 * Validates and formats a phone number ensuring proper country code.
 * Standard Colombian mobile numbers (10 digits starting with 3) are
 * automatically prefixed with '57'. International numbers (11-15 digits)
 * are validated as E.164.
 */
export function validateAndFormatPhone(phone: string): {
  isValid: boolean;
  phone: string;
  error?: string;
} {
  const cleaned = (phone || "").replace(/\D/g, "");
  if (!cleaned) {
    return {
      isValid: false,
      phone: "",
      error: "El número de WhatsApp es requerido",
    };
  }

  // 10 digits starting with 3: Colombian mobile number -> prefix with 57
  if (cleaned.length === 10 && cleaned.startsWith("3")) {
    return { isValid: true, phone: `57${cleaned}` };
  }

  // 12 digits starting with 573: already formatted Colombian mobile
  if (cleaned.length === 12 && cleaned.startsWith("573")) {
    return { isValid: true, phone: cleaned };
  }

  // International standard E.164 with country code: 11 to 15 digits
  if (cleaned.length >= 11 && cleaned.length <= 15) {
    return { isValid: true, phone: cleaned };
  }

  return {
    isValid: false,
    phone: cleaned,
    error:
      "El número debe incluir código de país " +
      "(ej. 573XXXXXXXXX para Colombia o código internacional)",
  };
}

/**
 * Formats a phone number into Colombian international standard (573XXXXXXXXX).
 */
export function formatColombianPhone(phone: string): string {
  return validateAndFormatPhone(phone).phone;
}

/**
 * Formats amount into COP currency format (e.g. $150.000 COP).
 */
export function formatCopCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} COP`;
}

/**
 * Formats amount into USD currency format (e.g. $50.00 USD).
 */
export function formatUsdCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} USD`;
}

/**
 * Formats amount according to specified currency (COP or USD).
 */
export function formatPaymentCurrency(
  amount: number,
  currency: "COP" | "USD" = "COP"
): string {
  return currency === "USD" ? formatUsdCurrency(amount) : formatCopCurrency(amount);
}

/**
 * Generates structured digital receipt message text for WhatsApp dispatch.
 */
export function buildReceiptMessageText(
  params: SendWhatsappReceiptParams
): string {
  const isUsd = params.currency === "USD";
  const amountValue = params.amountCop ?? params.amount ?? 0;
  const formattedAmount = isUsd
    ? `${formatUsdCurrency(params.amount || 0)} (USD)\n` +
      `💱 *Equivalente:* ~${formatCopCurrency(amountValue)}`
    : formatCopCurrency(amountValue);

  const folio =
    typeof params.receiptNumber === "number"
      ? `RC-${String(params.receiptNumber).padStart(4, "0")}`
      : `RC-${params.receiptNumber}`;

  const dateStr = new Date(params.createdAt || Date.now()).toLocaleString(
    "es-CO",
    {
      timeZone: "America/Bogota",
      dateStyle: "medium",
      timeStyle: "short",
    }
  );

  const clientName = params.clientName || params.studentName || "Abonado";
  const brand = params.brandName || "Kontrol ISP";
  const concept =
    params.conceptDescription ||
    (params.periodBilled
      ? `Mensualidad Internet - Período ${params.periodBilled}`
      : "Servicio de Internet Banda Ancha");

  return (
    `🌐 *${brand}*\n` +
    `🧾 *RECIBO DIGITAL DE PAGO #${folio}*\n\n` +
    `👤 *Abonado:* ${clientName}\n` +
    `📌 *Concepto:* ${concept}\n` +
    `💵 *Monto:* ${formattedAmount}\n` +
    `💳 *Medio de Pago:* ${params.paymentMethod.replace("_", " ")}\n` +
    `📅 *Fecha y Hora:* ${dateStr}\n\n` +
    `¡Gracias por confiar en nuestros servicios de telecomunicaciones! 🚀`
  );
}

/**
 * Dispatches digital payment receipt via Evolution API.
 */
export async function sendWhatsappReceipt(
  params: SendWhatsappReceiptParams & { instanceName?: string }
): Promise<EvolutionApiResponse> {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig(
    params.instanceName
  );
  const phoneCheck = validateAndFormatPhone(params.recipientPhone);

  if (!phoneCheck.isValid) {
    return {
      success: false,
      error: phoneCheck.error || "Número de WhatsApp del destinatario no válido o vacío",
    };
  }

  const recipient = phoneCheck.phone;

  if (!baseUrl || !apiKey) {
    return {
      success: false,
      error: "Evolution API config missing (EVOLUTION_API_URL / EVOLUTION_API_KEY)",
    };
  }

  const messageText = buildReceiptMessageText(params);

  try {
    const endpoint = `${baseUrl}/message/sendText/${instanceName}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: recipient,
        text: messageText,
        options: { delay: 1000 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 150)}`,
      };
    }

    const data = (await response.json()) as { key?: { id?: string }; id?: string };
    const messageId = data?.key?.id || data?.id || `EVO-${Date.now()}`;

    return { success: true, messageId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Network error connecting to Evolution API: ${errorMessage}`,
    };
  }
}

function extractCleanPhoneNumber(raw: unknown): string | null {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw.split("@")[0].split(":")[0].replace(/\D/g, "");
  return cleaned.length >= 7 ? cleaned : null;
}

/**
 * Fetches connection status from Evolution API.
 */
export async function fetchEvolutionStatus(
  overrideInstanceName?: string
): Promise<{
  success: boolean;
  state?: string;
  phoneNumber?: string | null;
  error?: string;
}> {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig(
    overrideInstanceName
  );
  if (!baseUrl || !apiKey) {
    return {
      success: false,
      state: "close",
      error: "Faltan variables EVOLUTION_API_URL o EVOLUTION_API_KEY",
    };
  }

  try {
    const endpoint = `${baseUrl}/instance/connectionState/${instanceName}`;
    const res = await fetch(endpoint, {
      method: "GET",
      headers: { apikey: apiKey },
      cache: "no-store",
    });

    let state = "close";
    let phoneNumber: string | null = null;

    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      const instObj = (data?.instance || data) as Record<string, unknown>;
      state = String(instObj?.state || data?.state || "close");

      phoneNumber =
        extractCleanPhoneNumber(instObj?.number) ||
        extractCleanPhoneNumber(instObj?.owner) ||
        extractCleanPhoneNumber(instObj?.ownerJid) ||
        extractCleanPhoneNumber(data?.owner) ||
        extractCleanPhoneNumber(data?.ownerJid);
    }

    // Fallback: Query fetchInstances if phoneNumber is null or state is open
    if (!phoneNumber || state === "open" || state === "connected") {
      try {
        const fetchInstRes = await fetch(
          `${baseUrl}/instance/fetchInstances?instanceName=${instanceName}`,
          {
            method: "GET",
            headers: { apikey: apiKey },
            cache: "no-store",
          }
        );
        if (fetchInstRes.ok) {
          const instData = await fetchInstRes.json();
          const items = Array.isArray(instData) ? instData : [instData];
          const matched =
            items.find(
              (i: Record<string, unknown>) =>
                i?.name === instanceName ||
                i?.instanceName === instanceName ||
                (i?.instance as Record<string, unknown>)?.instanceName ===
                instanceName
            ) || items[0];

          if (matched) {
            const mObj = (matched?.instance || matched) as Record<
              string,
              unknown
            >;
            const fetchState = String(
              mObj?.connectionStatus || mObj?.state || matched?.connectionStatus || ""
            );
            if (fetchState === "open" || fetchState === "connected") {
              state = "open";
            }
            if (!phoneNumber) {
              phoneNumber =
                extractCleanPhoneNumber(mObj?.number) ||
                extractCleanPhoneNumber(mObj?.ownerJid) ||
                extractCleanPhoneNumber(mObj?.owner) ||
                extractCleanPhoneNumber(mObj?.ownerPhoneNumber) ||
                extractCleanPhoneNumber(matched?.ownerJid) ||
                extractCleanPhoneNumber(matched?.number);
            }
          }
        }
      } catch (_err) {
        // Ignore fallback fetch error
      }
    }

    return { success: true, state, phoneNumber };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de conexión";
    return { success: false, state: "close", error: msg };
  }
}

/**
 * Fetches QR code for instance pairing.
 */
export async function fetchEvolutionQrCode(
  overrideInstanceName?: string
): Promise<{
  success: boolean;
  qrCode?: string;
  pairingCode?: string;
  status?: string;
  error?: string;
}> {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig(
    overrideInstanceName
  );
  if (!baseUrl || !apiKey) {
    return {
      success: false,
      error: "Faltan variables EVOLUTION_API_URL o EVOLUTION_API_KEY",
    };
  }

  try {
    // 1. Ensure instance exists with rejectCall & groupsIgnore
    const createUrl = `${baseUrl}/instance/create`;
    await fetch(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        rejectCall: true,
        reject_call: true,
        msgCall: "No se aceptan llamadas en esta línea de la academia.",
        groupsIgnore: true,
        groups_ignore: true,
        alwaysOnline: true,
      }),
    }).catch(() => null);

    // 2. Apply settings to instance (for both new and existing instances)
    const settingsUrl = `${baseUrl}/settings/set/${instanceName}`;
    await fetch(settingsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        rejectCall: true,
        reject_call: true,
        msgCall: "No se aceptan llamadas en esta línea de la academia.",
        groupsIgnore: true,
        groups_ignore: true,
        alwaysOnline: true,
      }),
    }).catch(() => null);

    // 3. Configure WebSocket for real-time upsert events
    await configureEvolutionWebsocket(instanceName);

    // 4. Fetch QR Code connect endpoint
    const connectUrl = `${baseUrl}/instance/connect/${instanceName}`;
    const res = await fetch(connectUrl, {
      method: "GET",
      headers: { apikey: apiKey },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        error: `HTTP ${res.status}: ${errorText.substring(0, 150)}`,
      };
    }

    const data = (await res.json()) as {
      base64?: string;
      code?: string;
      pairingCode?: string;
      status?: string;
      qrcode?: { base64?: string; code?: string };
      instance?: { state?: string };
    };

    const qrCode =
      data.base64 || data.code || data.qrcode?.base64 || data.qrcode?.code;
    const pairingCode = data.pairingCode;
    const status = data.status || data.instance?.state || "connecting";

    return { success: true, qrCode, pairingCode, status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al obtener QR";
    return { success: false, error: msg };
  }
}

/**
 * Logs out and disconnects WhatsApp instance.
 */
export async function logoutEvolutionInstance(
  overrideInstanceName?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig(
    overrideInstanceName
  );
  if (!baseUrl || !apiKey) {
    return { success: false, error: "Configuración incompleta" };
  }

  try {
    const endpoint = `${baseUrl}/instance/logout/${instanceName}`;
    const res = await fetch(endpoint, {
      method: "DELETE",
      headers: { apikey: apiKey },
    });

    if (!res.ok) {
      await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
        method: "POST",
        headers: { apikey: apiKey },
      }).catch(() => null);
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al desconectar";
    return { success: false, error: msg };
  }
}

/**
 * Configures WebSocket event streaming for an Evolution API instance.
 */
export async function configureEvolutionWebsocket(
  overrideInstanceName?: string
): Promise<{ success: boolean; error?: string }> {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig(
    overrideInstanceName
  );
  if (!baseUrl || !apiKey) {
    return {
      success: false,
      error: "Faltan variables EVOLUTION_API_URL o EVOLUTION_API_KEY",
    };
  }

  try {
    const wsUrl = `${baseUrl}/websocket/set/${instanceName}`;
    const res = await fetch(wsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        websocket: {
          enabled: true,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
          ],
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Configures the outbound webhook in Evolution API to dispatch events to Kontrol ISP
 * with the apikey authentication header included.
 */
export async function configureEvolutionWebhook(
  webhookUrl: string,
  overrideInstanceName?: string
): Promise<{ success: boolean; error?: string }> {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig(
    overrideInstanceName
  );
  if (!baseUrl || !apiKey) {
    return {
      success: false,
      error: "Faltan variables EVOLUTION_API_URL o EVOLUTION_API_KEY",
    };
  }

  try {
    const targetUrl = `${baseUrl}/webhook/set/${instanceName}`;
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          headers: {
            apikey: apiKey,
          },
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "CONNECTION_UPDATE",
          ],
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Sends a test WhatsApp text message.
 */
export async function sendTestWhatsappMessage(
  recipientPhone: string,
  message: string,
  overrideInstanceName?: string
): Promise<EvolutionApiResponse> {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig(
    overrideInstanceName
  );
  const phoneCheck = validateAndFormatPhone(recipientPhone);

  if (!phoneCheck.isValid) {
    return {
      success: false,
      error: phoneCheck.error || "Número de WhatsApp no válido",
    };
  }

  const recipient = phoneCheck.phone;

  if (!baseUrl || !apiKey) {
    return {
      success: false,
      error: "Faltan variables EVOLUTION_API_URL o EVOLUTION_API_KEY",
    };
  }

  try {
    const endpoint = `${baseUrl}/message/sendText/${instanceName}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: recipient,
        text: message,
        options: { delay: 1000 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 150)}`,
      };
    }

    const data = (await response.json()) as { key?: { id?: string }; id?: string };
    return {
      success: true,
      messageId: data?.key?.id || data?.id || `TEST-${Date.now()}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Sends a text message to a WhatsApp number via Evolution API.
 */
export async function sendWhatsappTextMessage(
  recipientPhone: string,
  message: string,
  overrideInstanceName?: string
): Promise<EvolutionApiResponse> {
  return sendTestWhatsappMessage(
    recipientPhone,
    message,
    overrideInstanceName
  );
}
