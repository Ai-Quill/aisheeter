/**
 * Stripe Service - Subscription & Payment Management
 * 
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: Stripe API key
 * - STRIPE_WEBHOOK_SECRET: Webhook signature verification
 * - STRIPE_PRICE_ID_PRO: Price ID for Pro tier
 * - NEXT_PUBLIC_APP_URL: Base URL for redirects
 * - MANAGED_OPENAI_API_KEY: Platform OpenAI key for managed credits
 * - MANAGED_ANTHROPIC_API_KEY: Platform Anthropic key for managed credits
 * - MANAGED_GOOGLE_API_KEY: Platform Google key for managed credits
 * - MANAGED_GROQ_API_KEY: Platform Groq key for managed credits
 * 
 * Pricing Tiers (Integer Credits):
 * - Free: 100 managed AI credits/month + 600 BYOK requests/month
 * - Pro: $14.99/mo - 1,000 managed AI credits/month + unlimited BYOK
 * - Legacy: Unlimited BYOK forever (existing users) — no managed credits
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set - Stripe features disabled');
}

export const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  : null;

export const PRICING_TIERS = {
  free: {
    name: 'Free',
    priceMonthly: 0,
    priceId: null,
    byokRequestLimit: 600,
    monthlyCredits: 100,
    features: [
      '100 AI credits/month (no setup needed!)',
      '600 BYOK requests/month',
      'Agent Mode + All Skills',
      'Mini AI models included',
    ]
  },
  pro: {
    name: 'Pro',
    priceMonthly: 14.99,
    priceId: process.env.STRIPE_PRICE_ID_PRO || null,
    byokRequestLimit: -1,
    monthlyCredits: 1000,
    features: [
      '1,000 AI credits/month',
      'Unlimited BYOK requests',
      'All AI models (GPT-5, Sonnet 4.5, Gemini Pro)',
      'Priority support',
      'Persistent conversation memory',
      'Early access to new features',
    ]
  },
  legacy: {
    name: 'Legacy',
    priceMonthly: 0,
    priceId: null,
    byokRequestLimit: -1,
    monthlyCredits: 0,
    features: ['Grandfathered unlimited BYOK access', 'All features included']
  }
} as const;

export type PlanTier = 'free' | 'pro' | 'legacy';

export function getMonthlyCreditsForTier(tier: PlanTier): number {
  return PRICING_TIERS[tier]?.monthlyCredits ?? 0;
}

export function getRequestLimitForTier(tier: PlanTier): number {
  switch (tier) {
    case 'free': return 600;
    case 'pro': return -1;
    case 'legacy': return -1;
    default: return 0;
  }
}

export function hasUnlimitedAccess(tier: PlanTier): boolean {
  return tier === 'legacy' || tier === 'pro';
}

export function getCreditsForTier(tier: PlanTier): number {
  return getMonthlyCreditsForTier(tier);
}

export function hasBYOKPrivileges(tier: PlanTier): boolean {
  return true;
}
