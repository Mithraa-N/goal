import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Graceful fallback to prevent crashes if Upstash env vars are missing during local dev
const useRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = useRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Distributed ratelimiter (Redis-backed) defaults to simple fallback if no Redis
const fallbackLimiters = new Map<string, number[]>();

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  if (redis) {
    // Upstash Ratelimit expects strict formats like '10 s'
    const windowSeconds = Math.max(1, Math.floor(windowMs / 1000));
    const rateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      analytics: false,
    });

    const { success } = await rateLimiter.limit(key);
    return success;
  }

  // Fallback to in-memory locally if Redis isn't configured for dev
  const now = Date.now();
  const windowStart = now - windowMs;
  let timestamps = fallbackLimiters.get(key) || [];
  timestamps = timestamps.filter((t) => t >= windowStart);

  if (timestamps.length >= limit) {
    return false;
  }

  timestamps.push(now);
  fallbackLimiters.set(key, timestamps);
  return true;
}
