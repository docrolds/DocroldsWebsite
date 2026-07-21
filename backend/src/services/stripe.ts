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

/**
 * Moves one collaborator's share of an order item to their connected
 * Stripe account. Shared by orders.ts's post-checkout transfer creation and
 * admin.ts's transfer-retry route, which both need the exact same
 * amount-computation and Stripe-call shape - previously duplicated
 * independently in both places. Callers own persisting the result (create
 * vs update an OrderItemTransfer row differ between the two call sites).
 *
 * Passes a deterministic idempotency key so retrying (whether via a network
 * retry, the admin retry route, or a bug) can never create two real
 * transfers for the same order item + collaborator pair.
 */
export async function transferToCollaborator(params: {
  orderItemId: string;
  collaboratorId: string;
  amount: number; // dollars
  stripeAccountId: string;
  sourceCharge: string;
}): Promise<string> {
  const stripe = getStripeClient();
  const transfer = await stripe.transfers.create(
    {
      amount: Math.round(params.amount * 100),
      currency: 'usd',
      destination: params.stripeAccountId,
      source_transaction: params.sourceCharge,
    },
    { idempotencyKey: `transfer-${params.orderItemId}-${params.collaboratorId}` }
  );
  return transfer.id;
}
