import { prisma } from "@/lib/prisma";

interface RateLimitCheck {
  limited: boolean;
  reset: Date | null;
}

interface RateLimitIncrement {
  success: boolean;
  points: number;
  reset: Date;
}

/**
 * Checks if a key is currently rate-limited (blocked).
 * This does not increment the count.
 */
export async function isRateLimited(
  key: string,
  limit: number
): Promise<RateLimitCheck> {
  const now = new Date();
  try {
    const record = await prisma.rateLimit.findUnique({
      where: { key },
    });

    if (record && record.points >= limit && record.expireAt > now) {
      return { limited: true, reset: record.expireAt };
    }
  } catch (error) {
    console.error(`[RATE LIMIT ERROR] Failed to check status for key ${key}:`, error);
  }

  return { limited: false, reset: null };
}

/**
 * Increments the points for a rate limit key.
 * If the points reach or exceed the limit, the expiration window is updated to the lockout
 * duration.
 *
 * @param key Unique key for the rate limit (e.g. `login:ip:${ip}`)
 * @param limit Maximum allowed points before lockout
 * @param windowSeconds Window duration in seconds (e.g. 180s = 3 minutes)
 * @param lockoutSeconds Lockout duration in seconds (e.g. 1800s = 30 minutes)
 */
export async function incrementRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  lockoutSeconds: number
): Promise<RateLimitIncrement> {
  const now = new Date();

  try {
    const record = await prisma.rateLimit.findUnique({
      where: { key },
    });

    if (record) {
      if (record.expireAt < now) {
        // Window has expired, start a new window
        const expireAt = new Date(Date.now() + windowSeconds * 1000);
        await prisma.rateLimit.update({
          where: { key },
          data: { points: 1, expireAt },
        });
        return { success: true, points: 1, reset: expireAt };
      }

      const nextPoints = record.points + 1;
      const isLocking = nextPoints >= limit;
      const expireAt = isLocking
        ? new Date(Date.now() + lockoutSeconds * 1000)
        : record.expireAt;

      await prisma.rateLimit.update({
        where: { key },
        data: { points: nextPoints, expireAt },
      });

      return { success: !isLocking, points: nextPoints, reset: expireAt };
    } else {
      // First failure, create a new window
      const expireAt = new Date(Date.now() + windowSeconds * 1000);
      await prisma.rateLimit.create({
        data: { key, points: 1, expireAt },
      });
      return { success: true, points: 1, reset: expireAt };
    }
  } catch (error) {
    console.error(`[RATE LIMIT ERROR] Failed to increment rate limit for key ${key}:`, error);
    return { success: true, points: 1, reset: new Date() };
  }
}

/**
 * Resets the rate limit for a key (typically called on successful login).
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await prisma.rateLimit.deleteMany({
      where: { key },
    });
  } catch (error) {
    console.error(`[RATE LIMIT ERROR] Failed to reset rate limit for key ${key}:`, error);
  }
}

/**
 * Helper to check if an IP address belongs to a private/local network range
 * (RFC 1918 IPv4 ranges, loopbacks, link-local, and docker bridge networks).
 */
export function isPrivateIp(ip: string): boolean {
  const cleanIp = ip.replace(/^::ffff:/i, "");

  if (cleanIp === "localhost" || cleanIp === "127.0.0.1" || cleanIp === "::1") {
    return true;
  }

  // IPv4 Private ranges check
  const parts = cleanIp.split(".");
  if (parts.length === 4) {
    const first = parseInt(parts[0], 10);
    const second = parseInt(parts[1], 10);

    if (isNaN(first) || isNaN(second)) return false;

    // 10.0.0.0/8
    if (first === 10) return true;
    // 172.16.0.0/12 (Docker bridge networks)
    if (first === 172 && second >= 16 && second <= 31) return true;
    // 192.168.0.0/16
    if (first === 192 && second === 168) return true;
    // 127.0.0.0/8 (Loopback)
    if (first === 127) return true;
  }

  // IPv6 Private / local ranges
  if (
    cleanIp.startsWith("fc00:") ||
    cleanIp.startsWith("fd00:") ||
    cleanIp.startsWith("fe80:")
  ) {
    return true;
  }

  return false;
}
