import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

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

function getMasterKey(): Buffer {
  return crypto.createHash("sha256").update(getSecretString()).digest();
}

/**
 * Encrypts a sensitive string using AES-256-GCM.
 * Output format: iv_hex:authTag_hex:ciphertext_hex
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12);
  const key = getMasterKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM ciphertext (iv:authTag:ciphertext).
 * Backwards-compatible: if the input is not in encrypted format (e.g. legacy
 * plaintext password), returns the input as-is safely.
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText) return "";
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 3) {
      return cipherText;
    }

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    const key = getMasterKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return cipherText;
  }
}
