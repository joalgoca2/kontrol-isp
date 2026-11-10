export interface BiometricAuthResult {
  success: boolean;
  credentialId?: string;
  error?: string;
}

export function isBiometricSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
    "function"
  );
}

export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  const isMatchMedia = window.matchMedia("(display-mode: standalone)").matches;
  const isNavStandalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(isMatchMedia || isNavStandalone);
}

export async function registerBiometricCredential(
  userName: string
): Promise<BiometricAuthResult> {
  try {
    if (!isBiometricSupported()) {
      return { success: false, error: "Biometrics not supported on this device" };
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userIdBytes = new TextEncoder().encode(userName);

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: "Kontrol PWA",
      },
      user: {
        id: userIdBytes,
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "preferred",
      },
      timeout: 60000,
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: "Credential creation failed" };
    }

    return {
      success: true,
      credentialId: credential.id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Biometric registration failed";
    return { success: false, error: msg };
  }
}

export async function authenticateBiometricCredential(
  credentialId: string
): Promise<BiometricAuthResult> {
  try {
    if (!isBiometricSupported()) {
      return { success: false, error: "Biometrics not supported on this device" };
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const rawId = new TextEncoder().encode(credentialId);

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: [
        {
          id: rawId,
          type: "public-key",
        },
      ],
      userVerification: "preferred",
      timeout: 60000,
    };

    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return { success: false, error: "Biometric authentication failed" };
    }

    return { success: true, credentialId: assertion.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Biometric auth failed";
    return { success: false, error: msg };
  }
}
