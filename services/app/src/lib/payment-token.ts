import crypto from "crypto";

function getSecretString(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL SECURITY: AUTH_SECRET or NEXTAUTH_SECRET is required."
      );
    }
    return "dev_kontrol_isp_internal_aes_key_unsecure";
  }
  return secret;
}

/**
 * Generates a tamper-proof URL-safe payment token for a contract using AES-256-GCM.
 * Format: {iv_base64url}.{authTag_base64url}.{ciphertext_base64url}
 */
export function generatePaymentToken(
  contractId: string,
  expiresInDays = 30
): string {
  const exp = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ cid: contractId, exp });
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(getSecretString()).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let enc = cipher.update(payload, "utf8", "base64url");
  enc += cipher.final("base64url");
  const tag = cipher.getAuthTag().toString("base64url");
  const ivStr = iv.toString("base64url");

  return `${ivStr}.${tag}.${enc}`;
}

/**
 * Verifies and decrypts a tamper-proof payment token.
 */
export function verifyPaymentToken(token: string): {
  valid: boolean;
  contractId?: string;
  error?: string;
} {
  try {
    if (!token) {
      return { valid: false, error: "Token no proporcionado." };
    }
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { valid: false, error: "Formato de token inválido." };
    }

    const [ivStr, tagStr, enc] = parts;
    const iv = Buffer.from(ivStr, "base64url");
    const tag = Buffer.from(tagStr, "base64url");
    const key = crypto.createHash("sha256").update(getSecretString()).digest();

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    let dec = decipher.update(enc, "base64url", "utf8");
    dec += decipher.final("utf8");

    const parsed = JSON.parse(dec) as { cid?: string; exp?: number };
    if (!parsed.cid) {
      return { valid: false, error: "Token no contiene contrato." };
    }

    if (parsed.exp && parsed.exp < Date.now()) {
      return { valid: false, error: "El enlace de pago ha expirado." };
    }

    return { valid: true, contractId: parsed.cid };
  } catch {
    return { valid: false, error: "Enlace de pago inválido o alterado." };
  }
}

