/**
 * Response Cache Service
 * 
 * Caches AI responses to reduce API costs.
 * Identical prompts return cached results instantly.
 * 
 * Cache hit rates typically 20-40% for spreadsheet use cases
 * (users often run same formulas on similar data)
 */

import crypto from 'crypto';
import { sql } from '@/lib/db';

// Cache TTL by model (expensive models = cache longer)
const CACHE_TTL_SECONDS: Record<string, number> = {
  // OpenAI
  'gpt-5.2': 7 * 24 * 60 * 60,           // 7 days
  'gpt-5.1': 7 * 24 * 60 * 60,           // 7 days
  'gpt-5-mini': 3 * 24 * 60 * 60,        // 3 days
  
  // Anthropic
  'claude-opus-4-5': 7 * 24 * 60 * 60,   // 7 days
  'claude-sonnet-4-5': 5 * 24 * 60 * 60, // 5 days
  'claude-haiku-4-5': 3 * 24 * 60 * 60,  // 3 days
  
  // Google
  'gemini-3-pro': 5 * 24 * 60 * 60,      // 5 days
  'gemini-2.5-pro': 5 * 24 * 60 * 60,    // 5 days
  'gemini-2.5-flash': 3 * 24 * 60 * 60,  // 3 days
  
  // Groq (fast, cheap - shorter cache)
  'meta-llama/llama-4-scout-17b-16e-instruct': 24 * 60 * 60,  // 1 day
  'meta-llama/llama-4-maverick-17b-128e-instruct': 24 * 60 * 60,  // 1 day
  
  // Default
  'default': 24 * 60 * 60,               // 1 day
};

export interface CacheEntry {
  response: string;
  tokensUsed: number;
  cached: true;
}

export interface CacheMiss {
  cached: false;
}

/**
 * Generate a cache key from model + system prompt + user prompt
 * Normalizes input for better hit rates
 */
export function generateCacheKey(
  model: string,
  systemPrompt: string | undefined,
  userPrompt: string
): string {
  // Normalize: trim whitespace, lowercase, remove extra spaces
  const normalized = [
    model.toLowerCase().trim(),
    (systemPrompt || '').trim(),
    userPrompt.trim().toLowerCase().replace(/\s+/g, ' ')
  ].join('::');
  
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Get cached response if exists and not expired
 */
export async function getFromCache(cacheKey: string): Promise<CacheEntry | CacheMiss> {
  try {
    const [data] = await sql`
      SELECT response, tokens_used, expires_at
      FROM response_cache
      WHERE cache_key = ${cacheKey}
    `;
    
    if (!data) {
      return { cached: false };
    }
    
    // Check expiration
    if (new Date(data.expires_at) < new Date()) {
      // Expired - delete and return miss
      await sql`DELETE FROM response_cache WHERE cache_key = ${cacheKey}`;
      return { cached: false };
    }
    
    // Cache hit! Update last_hit_at and increment hit count
    await sql`
      UPDATE response_cache
      SET last_hit_at = ${new Date().toISOString()}, hit_count = hit_count + 1
      WHERE cache_key = ${cacheKey}
    `;
    
    return {
      response: data.response,
      tokensUsed: data.tokens_used || 0,
      cached: true
    };
  } catch (error) {
    console.error('Cache lookup error:', error);
    return { cached: false };
  }
}

/**
 * Store response in cache
 */
export async function setCache(
  cacheKey: string,
  model: string,
  promptHash: string,
  response: string,
  tokensUsed: number
): Promise<void> {
  try {
    const ttl = CACHE_TTL_SECONDS[model] || CACHE_TTL_SECONDS.default;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    
    await sql`
      INSERT INTO response_cache (cache_key, model, prompt_hash, response, tokens_used, expires_at, created_at, last_hit_at, hit_count)
      VALUES (${cacheKey}, ${model}, ${promptHash}, ${response}, ${tokensUsed}, ${expiresAt.toISOString()}, ${new Date().toISOString()}, ${new Date().toISOString()}, 0)
      ON CONFLICT (cache_key) DO UPDATE SET
        response = ${response},
        tokens_used = ${tokensUsed},
        expires_at = ${expiresAt.toISOString()},
        last_hit_at = ${new Date().toISOString()},
        hit_count = 0
    `;
  } catch (error) {
    // Cache write failures shouldn't break the request
    console.error('Cache write error:', error);
  }
}

/**
 * Cleanup expired cache entries
 * Call this periodically (e.g., via cron)
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const now = new Date().toISOString();
    // Count and delete in one query
    const result = await sql`
      DELETE FROM response_cache WHERE expires_at < ${now}
    `;
    
    return Array.isArray(result) ? result.length : 0;
  } catch (error) {
    console.error('Cache cleanup error:', error);
    return 0;
  }
}
