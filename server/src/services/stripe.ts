import crypto from 'node:crypto';
import { config } from '../config.js';
import { getStore } from '../store/index.js';
import type { PlanTier } from '../domain/types.js';

const PRICE_ENV: Record<PlanTier, keyof typeof config.stripe.priceIds> = {
  starter: 'starter',
  growth: 'growth',
  business: 'business',
};

export function stripeConfigured(): boolean {
  return Boolean(config.stripe.secretKey && config.stripe.webhookSecret && Object.values(config.stripe.priceIds).every(Boolean));
}

export function priceIdForPlan(plan: PlanTier): string {
  const id = config.stripe.priceIds[PRICE_ENV[plan]];
  if (!id) throw new Error(`Stripe Price ID is not configured for the ${plan} plan.`);
  return id;
}

function formEncode(values: Record<string, string>): string {
  return new URLSearchParams(values).toString();
}

async function stripeRequest<T>(method: string, path: string, values: Record<string, string>): Promise<T> {
  if (!config.stripe.secretKey) throw new Error('Stripe is not configured.');
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${config.stripe.secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: formEncode(values),
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  if (!response.ok) {
    let message = 'Stripe request failed.';
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      message = parsed.error?.message ?? message;
    } catch { /* safe generic error */ }
    throw new Error(message);
  }
  return JSON.parse(raw) as T;
}

type CheckoutSession = { id: string; url: string };
type StripeSubscription = { id: string; status: string; customer: string | { id: string }; metadata?: Record<string, string> };

export async function createCheckoutSession(input: {
  organizationId: string;
  userId: string;
  email: string;
  plan: PlanTier;
}): Promise<CheckoutSession> {
  const origin = config.clientUrl || 'https://complense.vercel.app';
  return stripeRequest<CheckoutSession>('POST', 'checkout/sessions', {
    mode: 'subscription',
    success_url: `${origin}/pricing?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?billing=cancelled`,
    customer_email: input.email,
    'line_items[0][price]': priceIdForPlan(input.plan),
    'line_items[0][quantity]': '1',
    'metadata[organizationId]': input.organizationId,
    'metadata[userId]': input.userId,
    'metadata[plan]': input.plan,
    'subscription_data[metadata][organizationId]': input.organizationId,
    'subscription_data[metadata][plan]': input.plan,
  });
}

export function verifyStripeSignature(payload: string, signatureHeader: string): boolean {
  const secret = config.stripe.webhookSecret;
  if (!secret) return false;
  const parts = Object.fromEntries(signatureHeader.split(',').map((part) => {
    const [key, value] = part.split('=', 2);
    return [key, value];
  }));
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isFinite(timestamp) || !signature) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const signed = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(signature, 'utf8');
  return expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export async function applyStripeEvent(event: any): Promise<void> {
  const store = getStore();
  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object;
    const organizationId = session?.metadata?.organizationId;
    const plan = session?.metadata?.plan as PlanTier | undefined;
    if (!organizationId || !plan || !['starter', 'growth', 'business'].includes(plan)) return;
    await store.updateOrganization(organizationId, {
      plan,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      stripeSubscriptionStatus: 'active',
    });
    return;
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
    const subscription = event.data?.object as StripeSubscription;
    const organizationId = subscription?.metadata?.organizationId;
    const plan = subscription?.metadata?.plan as PlanTier | undefined;
    if (!organizationId) return;
    await store.updateOrganization(organizationId, {
      ...(plan && ['starter', 'growth', 'business'].includes(plan) ? { plan } : {}),
      stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
    });
    return;
  }
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data?.object as StripeSubscription;
    const organizationId = subscription?.metadata?.organizationId;
    if (!organizationId) return;
    await store.updateOrganization(organizationId, {
      plan: 'starter',
      stripeSubscriptionStatus: 'canceled',
    });
  }
}
