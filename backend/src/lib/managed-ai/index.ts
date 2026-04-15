/**
 * Managed AI Module - Pooled API Key Service
 * 
 * Provides managed AI access using platform-owned API keys.
 * Users don't need their own keys — integer credits are tracked per user.
 * 
 * Tiers:
 * - Free: Mini models only, 100 credits/month (1 credit per mini query)
 * - Pro:  Mini + mid-tier, 1,000 credits/month (1-8 credits per query)
 * - Legacy: No managed credits — they use their own API keys (BYOK).
 * 
 * Credit costs are fixed per model (not per-token):
 *   Mini models: 1 credit | Mid models: 3-8 credits
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { AIProvider } from '@/lib/ai/models';
import type { PlanTier } from '@/lib/stripe';
import { sql } from '@/lib/db';

// ============================================
// TYPES
// ============================================

export interface ManagedModelInfo {
  provider: AIProvider;
  modelId: string;
  displayName: string;
  costPer1kTokens: number;
  creditCost: number;
  tier: 'mini' | 'mid';
}

export interface ManagedCreditStatus {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  tier: PlanTier;
  reason?: string;
}

// ============================================
// MODEL REGISTRY
// ============================================

export const MANAGED_MODEL_REGISTRY: Record<string, ManagedModelInfo> = {
  'gpt-5-mini': {
    provider: 'CHATGPT',
    modelId: 'gpt-5-mini',
    displayName: 'GPT-5 Mini',
    costPer1kTokens: 0.00083,
    creditCost: 1,
    tier: 'mini',
  },
  'gemini-2.5-flash': {
    provider: 'GEMINI',
    modelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    costPer1kTokens: 0.0003,
    creditCost: 1,
    tier: 'mini',
  },
  'claude-haiku-4-5': {
    provider: 'CLAUDE',
    modelId: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    costPer1kTokens: 0.00233,
    creditCost: 1,
    tier: 'mini',
  },
  'meta-llama/llama-4-scout-17b-16e-instruct': {
    provider: 'GROQ',
    modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
    displayName: 'Llama 4 Scout (Groq)',
    costPer1kTokens: 0.000187,
    creditCost: 1,
    tier: 'mini',
  },
  'gpt-5': {
    provider: 'CHATGPT',
    modelId: 'gpt-5',
    displayName: 'GPT-5',
    costPer1kTokens: 0.00417,
    creditCost: 5,
    tier: 'mid',
  },
  'claude-sonnet-4-5': {
    provider: 'CLAUDE',
    modelId: 'claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    costPer1kTokens: 0.007,
    creditCost: 8,
    tier: 'mid',
  },
  'gemini-2.5-pro': {
    provider: 'GEMINI',
    modelId: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    costPer1kTokens: 0.00417,
    creditCost: 5,
    tier: 'mid',
  },
  'meta-llama/llama-4-maverick-17b-128e-instruct': {
    provider: 'GROQ',
    modelId: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    displayName: 'Llama 4 Maverick (Groq)',
    costPer1kTokens: 0.000333,
    creditCost: 3,
    tier: 'mid',
  },
};

export const TIER_MODEL_ALLOWLIST: Record<PlanTier, string[]> = {
  free: [
    'gpt-5-mini',
    'gemini-2.5-flash',
    'claude-haiku-4-5',
    'meta-llama/llama-4-scout-17b-16e-instruct',
  ],
  pro: [
    'gpt-5-mini',
    'gemini-2.5-flash',
    'claude-haiku-4-5',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'gpt-5',
    'claude-sonnet-4-5',
    'gemini-2.5-pro',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
  ],
  legacy: [
    'gpt-5-mini',
    'gemini-2.5-flash',
    'claude-haiku-4-5',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'gpt-5',
    'claude-sonnet-4-5',
    'gemini-2.5-pro',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
  ],
};

export const DEFAULT_MANAGED_MODEL: Record<PlanTier, string> = {
  free: 'gemini-2.5-flash',
  pro: 'gpt-5-mini',
  legacy: 'gpt-5-mini',
};

export const MONTHLY_CREDIT_LIMITS: Record<PlanTier, number> = {
  free: 100,
  pro: 1000,
  legacy: 0,
};

// ============================================
// ENVIRONMENT KEYS
// ============================================

function getManagedApiKey(provider: AIProvider): string | null {
  switch (provider) {
    case 'CHATGPT':
      return process.env.MANAGED_OPENAI_API_KEY || null;
    case 'CLAUDE':
      return process.env.MANAGED_ANTHROPIC_API_KEY || null;
    case 'GEMINI':
      return process.env.MANAGED_GOOGLE_API_KEY || null;
    case 'GROQ':
      return process.env.MANAGED_GROQ_API_KEY || null;
    default:
      return null;
  }
}

// ============================================
// CORE FUNCTIONS
// ============================================

export function isManagedModelAllowed(modelId: string, tier: PlanTier): boolean {
  const allowlist = TIER_MODEL_ALLOWLIST[tier];
  return allowlist?.includes(modelId) ?? false;
}

export function getManagedModel(
  modelId: string,
  tier: PlanTier
): { model: LanguageModel; provider: AIProvider; modelId: string } | null {
  if (!isManagedModelAllowed(modelId, tier)) {
    return null;
  }

  const modelInfo = MANAGED_MODEL_REGISTRY[modelId];
  if (!modelInfo) {
    return null;
  }

  const apiKey = getManagedApiKey(modelInfo.provider);
  if (!apiKey) {
    console.warn(`Managed API key not configured for provider: ${modelInfo.provider}`);
    return null;
  }

  let model: LanguageModel;
  switch (modelInfo.provider) {
    case 'CHATGPT':
      model = createOpenAI({ apiKey })(modelInfo.modelId);
      break;
    case 'CLAUDE':
      model = createAnthropic({ apiKey })(modelInfo.modelId);
      break;
    case 'GEMINI':
      model = createGoogleGenerativeAI({ apiKey })(modelInfo.modelId);
      break;
    case 'GROQ':
      model = createOpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' })(modelInfo.modelId);
      break;
    default:
      return null;
  }

  return { model, provider: modelInfo.provider, modelId: modelInfo.modelId };
}

/**
 * Get the integer credit cost for a model.
 * Returns the fixed per-query credit cost (not token-based).
 */
export function getModelCreditCost(modelId: string): number {
  const modelInfo = MANAGED_MODEL_REGISTRY[modelId];
  return modelInfo?.creditCost ?? 1;
}

/**
 * @deprecated Use getModelCreditCost() for the new integer credit system.
 * Kept for backward compatibility with existing agent routes during migration.
 */
export function calculateQueryCost(
  modelId: string,
  _inputTokens: number,
  _outputTokens: number
): number {
  return getModelCreditCost(modelId);
}

/**
 * Check if a user can use managed credits.
 * Reads integer credits_balance and auto-resets if period expired.
 */
export async function canUseManagedCredits(
  userIdOrEmail: string
): Promise<ManagedCreditStatus> {
  const isEmail = userIdOrEmail.includes('@');

  const [data] = isEmail
    ? await sql`SELECT id, plan_tier, credits_balance, credits_reset_at FROM users WHERE email = ${userIdOrEmail}`
    : await sql`SELECT id, plan_tier, credits_balance, credits_reset_at FROM users WHERE id = ${userIdOrEmail}`;

  if (!data) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      used: 0,
      tier: 'free',
      reason: 'User not found',
    };
  }

  const tier = (data.plan_tier || 'free') as PlanTier;
  const limit = MONTHLY_CREDIT_LIMITS[tier];
  let balance = Number(data.credits_balance) || 0;
  const resetAt = data.credits_reset_at ? new Date(data.credits_reset_at) : null;

  if (resetAt && resetAt < new Date()) {
    balance = limit;
    await sql`SELECT reset_managed_credits(${data.id})`;
  }

  const used = Math.max(0, limit - balance);
  const allowed = balance > 0 && limit > 0;

  return {
    allowed,
    remaining: balance,
    limit,
    used,
    tier,
    reason: allowed ? undefined : `AI credits exhausted (${limit}/month). Use your own API key for unlimited access, or upgrade to Pro.`,
  };
}

/**
 * Debit integer credits after a managed query.
 * Returns the new remaining balance.
 */
export async function debitManagedCredits(
  userId: string,
  credits: number
): Promise<number> {
  try {
    const [result] = await sql`SELECT debit_managed_credits(${userId}, ${credits}::integer) as new_balance`;
    return result?.new_balance ?? 0;
  } catch (error) {
    console.error('Failed to debit managed credits:', error);
    return -1;
  }
}

export function getManagedModelsForTier(tier: PlanTier): ManagedModelInfo[] {
  const allowlist = TIER_MODEL_ALLOWLIST[tier] || TIER_MODEL_ALLOWLIST.free;
  return allowlist
    .map((id) => MANAGED_MODEL_REGISTRY[id])
    .filter(Boolean);
}
