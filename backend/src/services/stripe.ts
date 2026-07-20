import Stripe from 'stripe';
import { config } from '../config/env';

/**
 * Stripe client, used only for the multi-producer collaborator payout path
 * (Connect accounts + transfers). Regular solo-beat/booking checkout stays
 * on Square - see orders.ts's payment-method branching. Lazily constructed
 * so a missing STRIPE_SECRET_KEY doesn't crash server boot, only the
 * specific routes that need it.
 */
let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    if (!config.stripe.secretKey) {
      throw new Error('Stripe is not configured (missing STRIPE_SECRET_KEY)');
    }
    stripeClient = new Stripe(config.stripe.secretKey);
  }
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(config.stripe.secretKey);
}
