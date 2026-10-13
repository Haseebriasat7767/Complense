import express, { Router } from 'express';
import { ApiError, asyncHandler } from '../http/errors.js';
import { requireAuth, sessionOf } from '../auth/middleware.js';
import { getStore } from '../store/index.js';
import { applyStripeEvent, createCheckoutSession, stripeConfigured, verifyStripeSignature } from '../services/stripe.js';
import type { PlanTier } from '../domain/types.js';

export const billingRouter = Router();

billingRouter.get('/billing/status', requireAuth(), asyncHandler(async (req, res) => {
  const session = sessionOf(req);
  const organization = await getStore().getOrganization(session.org);
  if (!organization) throw ApiError.forbidden('Organisation not found.');
  res.json({
    configured: stripeConfigured(),
    plan: organization.plan,
    subscriptionStatus: organization.stripeSubscriptionStatus ?? null,
  });
}));

billingRouter.post('/billing/checkout', requireAuth(), asyncHandler(async (req, res) => {
  const session = sessionOf(req);
  const plan = req.body?.plan as PlanTier;
  if (!['starter', 'growth', 'business'].includes(plan)) {
    throw ApiError.badRequest('Choose a valid plan: starter, growth, or business.');
  }
  if (!stripeConfigured()) {
    throw ApiError.serviceUnavailable('Billing is not configured yet. Add the Stripe environment variables in Vercel.');
  }
  const user = await getStore().getUserById(session.sub);
  if (!user) throw ApiError.forbidden('Account not found.');
  const checkout = await createCheckoutSession({
    organizationId: session.org,
    userId: user.id,
    email: user.email,
    plan,
  });
  res.json({ url: checkout.url });
}));

/**
 * Stripe must receive the exact raw request bytes for signature verification.
 * This route is mounted before express.json() in app.ts.
 */
billingRouter.post('/billing/webhook', express.raw({ type: 'application/json', limit: '2mb' }), asyncHandler(async (req, res) => {
  const signature = req.header('stripe-signature');
  if (!signature || !Buffer.isBuffer(req.body)) throw ApiError.badRequest('Invalid Stripe webhook payload.');
  const payload = req.body.toString('utf8');
  if (!verifyStripeSignature(payload, signature)) throw ApiError.unauthorized('Invalid Stripe webhook signature.');
  await applyStripeEvent(JSON.parse(payload));
  res.json({ received: true });
}));
