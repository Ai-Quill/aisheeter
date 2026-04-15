/**
 * Usage Check API
 * 
 * Returns user's current usage, limits, and tier information.
 * Used by frontend to display credit balance and BYOK usage.
 * 
 * Returns:
 * - BYOK request usage (remaining / limit for free tier)
 * - Managed AI credit balance (integer credits remaining / limit)
 * - Available managed models for the user's tier
 */

import { NextRequest, NextResponse } from 'next/server';
import { canPerformRequest } from '@/lib/auth/gating';
import { canUseManagedCredits, getManagedModelsForTier } from '@/lib/managed-ai';

export async function POST(request: NextRequest) {
  try {
    const { userId, userEmail } = await request.json();
    
    if (!userId && !userEmail) {
      return NextResponse.json(
        { error: 'Missing userId or userEmail' },
        { status: 400 }
      );
    }

    const identifier = userId || userEmail;

    const check = await canPerformRequest(identifier);
    const managedCredits = await canUseManagedCredits(identifier);

    const managedModels = getManagedModelsForTier(managedCredits.tier).map(m => ({
      id: m.modelId,
      name: m.displayName,
      provider: m.provider,
      tier: m.tier,
      creditCost: m.creditCost,
    }));

    return NextResponse.json({
      canProceed: check.allowed,
      remaining: check.remaining,
      limit: check.limit,
      tier: check.tier,
      isUnlimited: check.limit === -1,
      needsUpgrade: !check.allowed,
      reason: check.reason,
      managedCredits: {
        canUse: managedCredits.allowed,
        remaining: managedCredits.remaining,
        limit: managedCredits.limit,
        used: managedCredits.used,
      },
      managedModels,
    });

  } catch (error) {
    console.error('Usage check error:', error);
    return NextResponse.json(
      { error: 'Failed to check usage' },
      { status: 500 }
    );
  }
}
