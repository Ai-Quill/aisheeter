/**
 * Feature Gating & Request Management
 * 
 * Controls access to features based on user's subscription tier.
 * BYOK request limits: Free 600/month, Pro/Legacy unlimited.
 * Managed AI credits: Free 100/month, Pro 1000/month, Legacy 0.
 */

import { sql } from '@/lib/db';
import { getCreditsForTier, hasBYOKPrivileges, getRequestLimitForTier, hasUnlimitedAccess, type PlanTier } from '@/lib/stripe';

export interface UserAccess {
  userId: string;
  email: string;
  tier: PlanTier;
  creditsBalance: number;
  creditsLimit: number;
  isLegacy: boolean;
  hasBYOK: boolean;
}

export interface AccessCheck {
  allowed: boolean;
  reason?: string;
  userAccess?: UserAccess;
}

export async function getUserAccess(userIdOrEmail: string): Promise<UserAccess | null> {
  const isEmail = userIdOrEmail.includes('@');
  
  const [data] = isEmail
    ? await sql`SELECT id, email, plan_tier, credits_balance, is_legacy_user FROM users WHERE email = ${userIdOrEmail}`
    : await sql`SELECT id, email, plan_tier, credits_balance, is_legacy_user FROM users WHERE id = ${userIdOrEmail}`;

  if (!data) {
    return null;
  }

  const tier = (data.plan_tier || 'free') as PlanTier;

  return {
    userId: data.id,
    email: data.email,
    tier,
    creditsBalance: data.credits_balance || 0,
    creditsLimit: getCreditsForTier(tier),
    isLegacy: data.is_legacy_user || false,
    hasBYOK: hasBYOKPrivileges(tier) || data.is_legacy_user
  };
}

export async function canPerformQuery(
  userIdOrEmail: string, 
  estimatedCredits: number = 1
): Promise<AccessCheck> {
  const access = await getUserAccess(userIdOrEmail);
  
  if (!access) {
    return { allowed: false, reason: 'User not found' };
  }

  if (access.hasBYOK) {
    return { allowed: true, userAccess: access };
  }

  if (access.creditsBalance < estimatedCredits) {
    return { 
      allowed: false, 
      reason: `Insufficient credits. You have ${access.creditsBalance}, need ${estimatedCredits}.`,
      userAccess: access
    };
  }

  return { allowed: true, userAccess: access };
}

export async function canCreateJob(
  userIdOrEmail: string,
  rowCount: number
): Promise<AccessCheck> {
  const access = await getUserAccess(userIdOrEmail);
  
  if (!access) {
    return { allowed: false, reason: 'User not found' };
  }

  const dailyJobLimits: Record<PlanTier, number> = {
    free: 3,
    pro: -1,
    legacy: -1
  };

  const jobLimit = dailyJobLimits[access.tier];

  if (jobLimit === 0) {
    return { 
      allowed: false, 
      reason: 'Async jobs require a paid subscription.',
      userAccess: access
    };
  }

  if (jobLimit > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

      const [countResult] = await sql`
        SELECT COUNT(*)::int as count FROM jobs
        WHERE user_id = ${access.userId} AND created_at >= ${today.toISOString()}
      `;

      if ((countResult?.count || 0) >= jobLimit) {
      return { 
        allowed: false, 
        reason: `Daily job limit reached (${jobLimit} jobs/day). Upgrade for more.`,
        userAccess: access
      };
    }
  }

  const maxRowsPerJob: Record<PlanTier, number> = {
    free: 50,
    pro: 1000,
    legacy: 1000
  };

  if (rowCount > maxRowsPerJob[access.tier]) {
    return {
      allowed: false,
      reason: `Job too large. Max ${maxRowsPerJob[access.tier]} rows per job on ${access.tier} plan.`,
      userAccess: access
    };
  }

  return { allowed: true, userAccess: access };
}

export async function deductCredits(
  userId: string, 
  amount: number
): Promise<{ success: boolean; newBalance: number }> {
  const [result] = await sql`SELECT deduct_credits(${userId}, ${amount}) as new_balance`;

  if (!result) {
    console.error('Credit deduction failed');
    return { success: false, newBalance: -1 };
  }

  return { success: true, newBalance: result.new_balance || 0 };
}

export function canUseModel(tier: PlanTier, model: string): boolean {
  const premiumModels = [
    'gpt-5.2',
    'claude-opus-4-5',
    'gemini-3-pro'
  ];

  if (tier === 'free') {
    return !premiumModels.includes(model);
  }

  return true;
}

/**
 * Check if user can perform a BYOK request.
 * Free: 600/month, Pro/Legacy: unlimited.
 */
export async function canPerformRequest(
  userIdOrEmail: string
): Promise<{
  allowed: boolean;
  reason?: string;
  remaining: number;
  limit: number;
  tier: PlanTier;
}> {
  const isEmail = userIdOrEmail.includes('@');
  
  const [data] = isEmail
    ? await sql`SELECT id, email, plan_tier, is_legacy_user, requests_this_period, period_end FROM users WHERE email = ${userIdOrEmail}`
    : await sql`SELECT id, email, plan_tier, is_legacy_user, requests_this_period, period_end FROM users WHERE id = ${userIdOrEmail}`;

  if (!data) {
    return { 
      allowed: false, 
      reason: 'User not found',
      remaining: 0,
      limit: 0,
      tier: 'free'
    };
  }

  const tier = (data.plan_tier || 'free') as PlanTier;
  const limit = getRequestLimitForTier(tier);

  if (tier === 'legacy' || tier === 'pro' || hasUnlimitedAccess(tier)) {
    return { 
      allowed: true,
      remaining: -1,
      limit: -1,
      tier
    };
  }

  const periodEnd = new Date(data.period_end);
  const now = new Date();
  
  let used = data.requests_this_period || 0;
  
  if (periodEnd < now) {
    used = 0;
  }

  const remaining = Math.max(0, limit - used);
  const canProceed = used < limit;

  if (!canProceed) {
    return { 
      allowed: false, 
      reason: `Monthly BYOK limit reached (${limit} requests). Upgrade to Pro for unlimited access!`,
      remaining: 0,
      limit,
      tier
    };
  }

  return { 
    allowed: true,
    remaining,
    limit,
    tier
  };
}

export async function incrementRequestCount(userId: string): Promise<void> {
  try {
    await sql`SELECT increment_request_count(${userId})`;
  } catch (error) {
    console.error('Failed to increment request count:', error);
  }
}
