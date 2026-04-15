/**
 * Stripe Webhook Handler
 * 
 * Handles subscription lifecycle events:
 * - checkout.session.completed -> Create subscription, set integer credit balance
 * - invoice.paid -> Renew subscription, reset integer credits
 * - customer.subscription.updated -> Plan changes
 * - customer.subscription.deleted -> Cancellation, reset to free tier credits
 */

import { NextResponse } from 'next/server';
import { stripe, getMonthlyCreditsForTier, PRICING_TIERS, type PlanTier } from '@/lib/stripe';
import { sql } from '@/lib/db';
import Stripe from 'stripe';

export async function POST(req: Request): Promise<Response> {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.user_id;
  const tier = session.metadata?.tier as PlanTier;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error('No user_id in checkout session metadata');
    return;
  }

  await sql`
    INSERT INTO subscriptions (user_id, stripe_subscription_id, plan_tier, status, current_period_start, current_period_end)
    VALUES (${userId}, ${subscriptionId}, ${tier}, 'active', ${new Date().toISOString()}, ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()})
  `;

  const monthlyCredits = getMonthlyCreditsForTier(tier);
  await sql`
    UPDATE users SET
      stripe_customer_id = ${customerId},
      plan_tier = ${tier},
      credits_balance = ${monthlyCredits},
      credits_reset_at = ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${userId}
  `;

  console.log(`Subscription created for user ${userId}: ${tier}, credits: ${monthlyCredits}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === 'string' 
    ? invoice.parent.subscription_details.subscription
    : invoice.parent?.subscription_details?.subscription?.id;
  
  if (!subscriptionId) return;

  const [sub] = await sql`
    SELECT user_id, plan_tier FROM subscriptions
    WHERE stripe_subscription_id = ${subscriptionId}
  `;

  if (!sub) {
    console.error(`Subscription not found: ${subscriptionId}`);
    return;
  }

  const monthlyCredits = getMonthlyCreditsForTier(sub.plan_tier as PlanTier);
  
  await sql`
    UPDATE users SET
      credits_balance = ${monthlyCredits},
      credits_reset_at = ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${sub.user_id}
  `;

  await sql`
    UPDATE subscriptions SET
      current_period_start = ${new Date().toISOString()},
      current_period_end = ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()},
      updated_at = ${new Date().toISOString()}
    WHERE stripe_subscription_id = ${subscriptionId}
  `;

  console.log(`Credits reset for user ${sub.user_id}: ${monthlyCredits}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const cancelAtEnd = subscription.cancel_at_period_end;

  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    trialing: 'trialing',
  };

  await sql`
    UPDATE subscriptions SET
      status = ${statusMap[status] || 'paused'},
      cancel_at_period_end = ${cancelAtEnd},
      updated_at = ${new Date().toISOString()}
    WHERE stripe_subscription_id = ${subscriptionId}
  `;
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const subscriptionId = subscription.id;

  const [sub] = await sql`
    SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ${subscriptionId}
  `;

  if (sub) {
    const freeCredits = getMonthlyCreditsForTier('free');
    await sql`
      UPDATE users SET
        plan_tier = 'free',
        credits_balance = ${freeCredits},
        credits_reset_at = ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${sub.user_id}
    `;
  }

  await sql`
    UPDATE subscriptions SET
      status = 'canceled',
      updated_at = ${new Date().toISOString()}
    WHERE stripe_subscription_id = ${subscriptionId}
  `;

  console.log(`Subscription canceled: ${subscriptionId}`);
}
