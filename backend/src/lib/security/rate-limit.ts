/**
 * Rate Limiting Service
 * 
 * Uses @upstash/ratelimit for distributed rate limiting.
 * Falls back to a no-op limiter when UPSTASH_REDIS_REST_URL is not configured,
 * so the app still works in development or without Upstash.
 * 
 * Tiers:
 * - AI routes (parse-chain, query): 30 requests per 60 seconds
 * - Job creation: 10 requests per 60 seconds
 * - General API: 60 requests per 60 seconds
 * 
 * @version 1.0.0
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ============================================
// CONFIGURATION
// ============================================

const UPSTASH_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const isConfigured = !!(UPSTASH_REST_URL && UPSTASH_REST_TOKEN);

/**
 * Create a Redis client for Upstash (only if configured)
 */
function createRedis(): Redis | null {
  if (!isConfigured) return null;
  return new Redis({
    url: UPSTASH_REST_URL!,
    token: UPSTASH_REST_TOKEN!,
  });
}

const redis = createRedis();

// ============================================
// RATE LIMITERS
// ============================================

/**
 * Rate limiter for AI-heavy routes (parse-chain, query)
 * 30 requests per 60 seconds per identifier
 */
const aiLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '60 s'), prefix: 'rl:ai' })
  : null;

/**
 * Rate limiter for job creation
 * 10 requests per 60 seconds per identifier
 */
const jobLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '60 s'), prefix: 'rl:job' })
  : null;

/**
 * Rate limiter for general API routes
 * 60 requests per 60 seconds per identifier
 */
const generalLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '60 s'), prefix: 'rl:gen' })
  : null;

// ============================================
// PUBLIC API
// ============================================

export type RateLimitTier = 'ai' | 'job' | 'general';

interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  reset: number;
}

/**
 * Check rate limit for an identifier (userId, email, or IP).
 * Returns { success: true } if allowed, { success: false } if rate limited.
 * 
 * When Upstash is not configured, always allows (no-op).
 */
export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = 'general'
): Promise<RateLimitResult> {
  const limiter = tier === 'ai' ? aiLimiter : tier === 'job' ? jobLimiter : generalLimiter;

  // No-op when Upstash is not configured (dev mode or not set up yet)
  if (!limiter) {
    return { success: true, remaining: 999, limit: 999, reset: 0 };
  }

  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    limit: result.limit,
    reset: result.reset,
  };
}

/**
 * Get rate limit headers to include in the response.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  };
}
