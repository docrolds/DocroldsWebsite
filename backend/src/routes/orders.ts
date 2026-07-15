/**
 * Orders Routes
 * Handles all order-related API endpoints including:
 * - Checkout with Square payment processing
 * - Order lookup
 * - Download management (token-based and file downloads)
 * - Square webhooks
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { SquareClient, SquareEnvironment } from 'square';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { config } from '../config/env';
import { sendEmail } from '../services/email';
import { captureError } from '../services/sentry';
import { paymentLimiter, authenticateToken, requireAdmin } from '../middleware';
import {
  asyncHandler,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalError,
} from '../middleware';
import type {
  CartItem,
  LicenseType,
  SquareWebhookEvent,
} from '../types';

const router = Router();
const prisma = new PrismaClient();

// ===========================================
// SQUARE CLIENT INITIALIZATION
// ===========================================

const squareClient = new SquareClient({
  token: config.square.accessToken,
  environment:
    config.square.environment === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
});

console.log(
  '[SQUARE] Square client initialized in',
  config.square.environment,
  'mode'
);

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Email validation helper
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Timing-safe comparison for access tokens (e.g. Order.confirmationToken),
 * used to gate lookups keyed by a guessable/sequential public ID.
 */
const isValidToken = (provided: string, expected: string): boolean => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Escape HTML for email templates
 */
const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Generate unique order number
 */
async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.order.count({
    where: {
      createdAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  });
  const sequence = count + 1;
  return `DR-${year}-${sequence.toString().padStart(5, '0')}`;
}

/**
 * Create a notification for a customer
 */
async function createNotification(
  customerId: string,
  type: string,
  title: string,
  message: string,
  data: Prisma.InputJsonValue | null = null
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        customerId,
        type,
        title,
        message,
        data: data ?? Prisma.JsonNull,
      },
    });
    console.log(`[NOTIFICATION] Created: ${type} for customer ${customerId}`);
  } catch (error) {
    console.error(
      '[NOTIFICATION] Error creating notification:',
      (error as Error).message
    );
  }
}

// ===========================================
// ORDER PROCESSING FUNCTIONS
// ===========================================

interface OrderWithRelations {
  id: string;
  orderNumber: string;
  customerId: string;
  downloadToken: string;
  total: number;
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    isGuest: boolean;
  };
  items: Array<{
    beat: {
      title: string;
    };
    licenseType: string;
    licenseName: string;
    price: number;
  }>;
}

/**
 * Handle successful payment (called after Square payment completes)
 */
async function handleSuccessfulPayment(
  order: { id: string; orderNumber: string },
  squarePaymentId: string
): Promise<void> {
  console.log(
    '[PAYMENT] Processing successful payment for order:',
    order.orderNumber
  );

  // Reload order with relations
  const fullOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { customer: true, items: { include: { beat: true } } },
  });

  if (!fullOrder) {
    console.error('[PAYMENT] Order not found:', order.id);
    return;
  }

  // Update order status
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      squarePaymentId: squarePaymentId,
    },
  });

  // Reload with updated status for email
  const updatedOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { customer: true, items: { include: { beat: true } } },
  });

  // Send download email
  if (updatedOrder) {
    await sendDownloadEmail(updatedOrder as OrderWithRelations);
  }

  // Create notification for customer
  const beatTitles = fullOrder.items.map((item) => item.beat.title).join(', ');
  await createNotification(
    fullOrder.customerId,
    'ORDER_COMPLETED',
    'Order Confirmed!',
    `Your order #${fullOrder.orderNumber} is complete. Your beats are ready to download: ${beatTitles}`,
    {
      orderNumber: fullOrder.orderNumber,
      downloadToken: fullOrder.downloadToken,
      total: fullOrder.total,
      actionUrl: `/download/${fullOrder.downloadToken}`,
    }
  );

  console.log('[PAYMENT] Order completed:', fullOrder.orderNumber);
}

/**
 * Send download email to customer
 */
async function sendDownloadEmail(order: OrderWithRelations): Promise<void> {
  const downloadUrl = `${config.frontendUrl}/download/${order.downloadToken}`;
  const licenseUrl = `${config.frontendUrl}/licenses`;

  const itemsList = order.items
    .map(
      (item) => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(item.beat.title)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">
                <a href="${licenseUrl}?type=${item.licenseType?.toLowerCase() || 'standard'}" style="color: #E83628; text-decoration: none;">
                    ${escapeHtml(item.licenseName)}
                </a>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">$${item.price.toFixed(2)}</td>
        </tr>
    `
    )
    .join('');

  const expiryNotice = order.customer.isGuest
    ? `<p style="color: #E83628; font-weight: bold;">Guest checkout: Your download link expires in ${config.downloadLinkExpiryDays} days. Create an account for unlimited access!</p>`
    : '';

  const mailOptions = {
    to: order.customer.email,
    subject: `Your Doc Rolds Order #${order.orderNumber} - Download Ready!`,
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 30px;">
                <h1 style="color: #E83628; text-align: center;">Your Beats Are Ready!</h1>

                <p>Hey ${escapeHtml(order.customer.firstName || 'there')},</p>
                <p>Thanks for your purchase! Your order <strong>#${order.orderNumber}</strong> is complete.</p>

                ${expiryNotice}

                <h3 style="color: #E83628; margin-top: 30px;">Order Details:</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #333;">
                            <th style="padding: 10px; text-align: left;">Beat</th>
                            <th style="padding: 10px; text-align: left;">License</th>
                            <th style="padding: 10px; text-align: left;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsList}
                    </tbody>
                    <tfoot>
                        <tr style="background: #333;">
                            <td colspan="2" style="padding: 10px;"><strong>Total</strong></td>
                            <td style="padding: 10px;"><strong>$${order.total.toFixed(2)}</strong></td>
                        </tr>
                    </tfoot>
                </table>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${downloadUrl}" style="background: #E83628; color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 18px; display: inline-block;">
                        Download Your Beats
                    </a>
                </div>

                <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                    If the button doesn't work, copy this link: ${downloadUrl}
                </p>

                <div style="background: #222; border-radius: 8px; padding: 20px; margin-top: 30px;">
                    <h3 style="color: #E83628; margin: 0 0 15px 0; font-size: 14px;">License Terms - IMPORTANT</h3>
                    <ul style="color: #ccc; font-size: 12px; margin: 0; padding-left: 20px; line-height: 1.8;">
                        <li><strong>Credit Required:</strong> You MUST credit "Prod. by Doc Rolds" on ALL releases</li>
                        <li><strong>Master Rights:</strong> Producer retains master ownership on all license types</li>
                        <li><strong>All Versions:</strong> Credit required on remixes, edits, and live performances</li>
                        <li>All licenses are perpetual (lifetime validity)</li>
                    </ul>
                    <p style="margin: 15px 0 0; text-align: center;">
                        <a href="${config.frontendUrl}/licenses" style="color: #E83628; font-size: 12px;">View Full License Terms</a>
                    </p>
                </div>

                <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">

                <p style="color: #999; font-size: 12px; text-align: center;">
                    Doc Rolds Music - <a href="${config.frontendUrl}" style="color: #E83628;">docrolds.com</a>
                </p>
            </div>
        `,
  };

  try {
    await sendEmail(mailOptions);
    await prisma.order.update({
      where: { id: order.id },
      data: { emailSent: true },
    });
    console.log('[EMAIL] Download email sent to:', order.customer.email);
  } catch (error) {
    console.error(
      '[EMAIL] Failed to send download email:',
      (error as Error).message
    );
    captureError(error, { orderNumber: order.orderNumber, context: 'download-email' });
  }
}

// ===========================================
// LICENSE TIER CONFIGURATION
// ===========================================

interface LicenseTierConfig {
  type: LicenseType;
  name: string;
  price: number;
}

const LICENSE_TIERS: LicenseTierConfig[] = [
  { type: 'STANDARD', name: 'Standard Lease', price: 50 },
  { type: 'UNLIMITED', name: 'Unlimited Lease', price: 150 },
];

function getLicenseTier(
  licenseType: LicenseType
): LicenseTierConfig | undefined {
  return LICENSE_TIERS.find((tier) => tier.type === licenseType);
}

// ===========================================
// SQUARE WEBHOOK
// ===========================================

/**
 * Verifies a Square webhook signature against the raw request body.
 * See: https://developer.squareup.com/docs/webhooks/step3verify
 */
function isValidSquareSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined
): boolean {
  const { webhookSignatureKey, webhookNotificationUrl } = config.square;

  // Fail closed if verification isn't configured: an unverified webhook
  // endpoint lets anyone who knows a real Square payment ID forge a
  // "refund.created" event and flip that order to REFUNDED, blocking the
  // legitimate customer's download. Rejecting is safer than accepting -
  // this only means real Square webhooks get rejected too until the key
  // is set (logged as a startup warning), not that checkout/payments break
  // (that's a separate route).
  if (!webhookSignatureKey || !webhookNotificationUrl) {
    return false;
  }

  if (!rawBody || !signatureHeader) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', webhookSignatureKey);
  hmac.update(webhookNotificationUrl + rawBody.toString());
  const expectedSignature = hmac.digest('base64');

  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signatureHeader);
  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

/**
 * Extracts a Square payment ID from a refund or payment webhook payload,
 * without assuming the full shape of Square's API types.
 */
function extractPaymentId(eventObject: Record<string, unknown>): string | undefined {
  const refund = eventObject.refund as Record<string, unknown> | undefined;
  const payment = eventObject.payment as Record<string, unknown> | undefined;
  const paymentId = refund?.payment_id ?? payment?.id;
  return typeof paymentId === 'string' ? paymentId : undefined;
}

/**
 * POST /api/webhooks/square
 * Handle Square webhook events (refunds, disputes, etc.)
 */
router.post(
  '/webhooks/square',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const signature = req.header('x-square-hmacsha256-signature');
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    if (!isValidSquareSignature(rawBody, signature)) {
      console.warn('[SQUARE WEBHOOK] Rejected event with invalid signature');
      throw new UnauthorizedError('Invalid signature');
    }

    const event = req.body as SquareWebhookEvent;
    console.log('[SQUARE WEBHOOK] Event received:', event.type);

    try {
      if (event.type === 'refund.created' || event.type === 'refund.updated') {
        const paymentId = extractPaymentId(event.data.object);
        if (paymentId) {
          const order = await prisma.order.findFirst({
            where: { squarePaymentId: paymentId },
          });

          if (order && order.paymentStatus !== 'REFUNDED') {
            await prisma.order.update({
              where: { id: order.id },
              data: { paymentStatus: 'REFUNDED' },
            });
            console.log(
              `[SQUARE WEBHOOK] Order ${order.orderNumber} marked as REFUNDED`
            );
          }
        }
      }
    } catch (error) {
      // Acknowledge receipt even if our processing fails - Square will
      // retry undelivered/failed webhooks, and we don't want retries
      // piling up for a bug on our side turning into duplicate work.
      console.error('[SQUARE WEBHOOK] Error processing event:', error);
      captureError(error, { eventType: event.type, context: 'square-webhook' });
    }

    res.json({ received: true });
  })
);

// ===========================================
// CHECKOUT ENDPOINTS
// ===========================================

interface ProcessPaymentRequest {
  sourceId: string;
  items: CartItem[];
  customer: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    password?: string;
  };
}

/**
 * POST /api/checkout/process-payment
 * Process payment with Square
 */
router.post(
  '/checkout/process-payment',
  paymentLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sourceId, items, customer: customerData } =
      req.body as ProcessPaymentRequest;

    // Validate source ID (payment token from Square Web Payments SDK)
    if (!sourceId) {
      throw new BadRequestError('Payment source is required');
    }

    if (!items || items.length === 0) {
      throw new BadRequestError('Cart is empty');
    }

    if (!customerData || !customerData.email) {
      throw new BadRequestError('Customer email is required');
    }

    if (!isValidEmail(customerData.email)) {
      throw new BadRequestError('Invalid email format');
    }

    // Find or create customer
    let customer = await prisma.customer.findUnique({
      where: { email: customerData.email },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          email: customerData.email,
          firstName: customerData.firstName || null,
          lastName: customerData.lastName || null,
          phone: customerData.phone || null,
          isGuest: !customerData.password,
        },
      });
    }

    // Validate items and get beat details
    const beatIds = items.map((item) => item.beatId);
    const beats = await prisma.beat.findMany({
      where: { id: { in: beatIds } },
    });

    if (beats.length !== items.length) {
      throw new BadRequestError('Some beats not found');
    }

    // Calculate totals
    // TODO(tax): no sales tax is calculated or collected anywhere in this
    // flow. Before adding it, confirm with an accountant whether digital
    // beat licenses are taxable in FL / the customer's state (nexus rules
    // vary by jurisdiction) - this is a compliance decision, not just a
    // missing feature.
    const orderItems: Array<{
      beatId: string;
      licenseType: string;
      licenseName: string;
      price: number;
    }> = [];
    let subtotal = 0;

    for (const item of items) {
      const beat = beats.find((b) => b.id === item.beatId);
      if (!beat) continue;

      // Get license tier
      const licenseTier = getLicenseTier(item.licenseType);
      if (!licenseTier) {
        throw new BadRequestError(`Invalid license type: ${item.licenseType}`);
      }

      subtotal += licenseTier.price;
      orderItems.push({
        beatId: beat.id,
        licenseType: item.licenseType,
        licenseName: licenseTier.name,
        price: licenseTier.price,
      });
    }

    // Generate order number
    const orderNumber = await generateOrderNumber();

    // Set download expiry for guests (7 days)
    const downloadExpiresAt = customer.isGuest
      ? new Date(
          Date.now() + config.downloadLinkExpiryDays * 24 * 60 * 60 * 1000
        )
      : null;

    // Create order in pending state
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        subtotal,
        total: subtotal,
        downloadExpiresAt,
        items: {
          create: orderItems,
        },
      },
    });

    console.log(
      '[SQUARE] Processing payment for order:',
      orderNumber,
      'Amount:',
      subtotal * 100,
      'cents'
    );

    // The Square payment call and its outcome handling below are wrapped
    // in their own try/catch (rather than relying on the outer asyncHandler)
    // because failures here need bespoke, user-facing responses derived from
    // Square's error shape - the centralized handler's generic 500 body
    // would lose that detail. Genuine unexpected/internal failures still
    // fall through to a thrown InternalError so the raw error message is
    // never leaked to the client.
    try {
      // Process payment with Square
      const paymentResponse = await squareClient.payments.create({
        sourceId: sourceId,
        idempotencyKey: order.id, // Use order ID as idempotency key
        amountMoney: {
          amount: BigInt(subtotal * 100), // Square uses cents as BigInt
          currency: 'USD',
        },
        locationId: config.square.locationId,
        note: `Order ${orderNumber} - Doc Rolds Beats`,
        referenceId: orderNumber,
      });

      if (paymentResponse.payment?.status === 'COMPLETED') {
        console.log(
          '[SQUARE] Payment successful:',
          paymentResponse.payment.id
        );

        // Handle successful payment
        await handleSuccessfulPayment(order, paymentResponse.payment.id || '');

        res.json({
          success: true,
          orderNumber: order.orderNumber,
          paymentId: paymentResponse.payment.id,
          redirectUrl: `/order/${orderNumber}?success=true&key=${order.confirmationToken}`,
        });
      } else {
        console.error(
          '[SQUARE] Payment not completed:',
          paymentResponse.payment?.status
        );

        // Update order as failed
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            paymentStatus: 'FAILED',
          },
        });

        res.status(400).json({
          success: false,
          message: 'Payment was not completed',
          status: paymentResponse.payment?.status,
        });
      }
    } catch (error) {
      console.error('[CHECKOUT] Error processing payment:', error);
      captureError(error, { orderNumber: order.orderNumber, context: 'checkout-payment' });

      // Square API errors have specific structure
      const squareError = error as { errors?: Array<{ detail?: string; code?: string }> };
      if (squareError.errors) {
        const firstError = squareError.errors[0];
        res.status(400).json({
          success: false,
          message: firstError?.detail || 'Payment failed',
          code: firstError?.code,
        });
        return;
      }

      throw new InternalError('Failed to process payment');
    }
  })
);

/**
 * GET /api/checkout/square-config
 * Get Square Application ID for frontend
 */
router.get('/checkout/square-config', (_req: Request, res: Response): void => {
  res.json({
    applicationId: config.square.applicationId,
    locationId: config.square.locationId,
    environment: config.square.environment,
  });
});

// ===========================================
// ORDER ENDPOINTS
// ===========================================

/**
 * GET /api/orders/:orderNumber
 * Get order by order number (public - for order confirmation page)
 * Requires a matching ?key= confirmation token since orderNumber is
 * sequential and guessable; the token is not.
 */
router.get(
  '/orders/:orderNumber',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const orderNumber = req.params.orderNumber as string;
    const key = typeof req.query.key === 'string' ? req.query.key : undefined;

    if (!key) {
      throw new BadRequestError('Missing confirmation key');
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        customer: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            isGuest: true,
          },
        },
        items: {
          include: {
            beat: {
              select: {
                id: true,
                title: true,
                genre: true,
                bpm: true,
                key: true,
                coverArt: true,
              },
            },
          },
        },
      },
    });

    if (!order || !isValidToken(key, order.confirmationToken)) {
      throw new NotFoundError('Order not found');
    }

    res.json(order);
  })
);

/**
 * GET /api/admin/orders
 * List all orders for the admin dashboard.
 */
router.get(
  '/admin/orders',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const orders = await prisma.order.findMany({
      include: {
        customer: {
          select: { email: true },
        },
        items: {
          include: {
            beat: {
              select: { id: true, title: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerEmail: order.customer.email,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.total,
        downloadToken: order.downloadToken,
        downloadExpiresAt: order.downloadExpiresAt,
        notes: order.notes,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items,
      }))
    );
  })
);

/**
 * POST /api/admin/orders/:id/resend-email
 * Resend the download confirmation email for a completed order.
 */
router.post(
  '/admin/orders/:id/resend-email',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const orderId = req.params.id as string;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: { include: { beat: true } } },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    await sendDownloadEmail(order as OrderWithRelations);
    res.json({ success: true, message: 'Email resent' });
  })
);

interface AdminUpdateOrderRequest {
  extendDownload?: boolean;
  notes?: string;
}

/**
 * PUT /api/admin/orders/:id
 * Update admin-editable fields on an order - currently supports extending
 * the guest download window by another DOWNLOAD_LINK_EXPIRY_DAYS, and
 * updating admin notes.
 */
router.put(
  '/admin/orders/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const orderId = req.params.id as string;
    const { extendDownload, notes } = req.body as AdminUpdateOrderRequest;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const data: Prisma.OrderUpdateInput = {};

    if (extendDownload) {
      const base = order.downloadExpiresAt && order.downloadExpiresAt > new Date()
        ? order.downloadExpiresAt
        : new Date();
      data.downloadExpiresAt = new Date(
        base.getTime() + config.downloadLinkExpiryDays * 24 * 60 * 60 * 1000
      );
    }

    if (notes !== undefined) {
      data.notes = notes;
    }

    const updated = await prisma.order.update({ where: { id: orderId }, data });
    res.json(updated);
  })
);

/**
 * DELETE /api/admin/orders/:id
 * Permanently delete an order and its items (cascade).
 */
router.delete(
  '/admin/orders/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const orderId = req.params.id as string;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    await prisma.order.delete({ where: { id: orderId } });
    res.json({ success: true });
  })
);

interface RefundOrderRequest {
  reason?: string;
}

/**
 * POST /api/orders/:id/refund
 * Refund a paid order via Square (admin only). Refunds the full payment
 * amount and marks the order REFUNDED - this is the only place that both
 * issues the Square refund and updates our own record of it, since the
 * webhook only reflects refunds initiated in the Square dashboard.
 */
router.post(
  '/orders/:id/refund',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const orderId = req.params.id as string;
    const { reason } = req.body as RefundOrderRequest;

    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (!order.squarePaymentId) {
      throw new BadRequestError('Order has no associated payment to refund');
    }

    if (order.paymentStatus === 'REFUNDED') {
      throw new ConflictError('Order has already been refunded');
    }

    if (order.paymentStatus !== 'PAID') {
      throw new BadRequestError(
        `Cannot refund an order with payment status ${order.paymentStatus}`
      );
    }

    try {
      const refundResponse = await squareClient.refunds.refundPayment({
        idempotencyKey: `order-refund-${order.id}`,
        paymentId: order.squarePaymentId,
        amountMoney: {
          amount: BigInt(Math.round(order.total * 100)),
          currency: 'USD',
        },
        reason: reason || `Refund for order ${order.orderNumber}`,
      });

      if (
        refundResponse.refund?.status === 'REJECTED' ||
        refundResponse.refund?.status === 'FAILED'
      ) {
        throw new InternalError(
          `Square rejected the refund: ${refundResponse.refund.status}`
        );
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED', paymentStatus: 'REFUNDED' },
      });

      console.log(
        `[REFUND] Order ${order.orderNumber} refunded by admin, Square refund ID:`,
        refundResponse.refund?.id
      );

      res.json({
        success: true,
        orderNumber: order.orderNumber,
        refundId: refundResponse.refund?.id,
        status: refundResponse.refund?.status,
      });
    } catch (error) {
      if (error instanceof InternalError) throw error;

      console.error('[REFUND] Error refunding order:', error);
      captureError(error, { orderNumber: order.orderNumber, context: 'admin-refund-order' });

      const squareError = error as { errors?: Array<{ detail?: string; code?: string }> };
      if (squareError.errors) {
        const firstError = squareError.errors[0];
        throw new BadRequestError(firstError?.detail || 'Refund failed', firstError?.code);
      }

      throw new InternalError('Failed to process refund');
    }
  })
);

// ===========================================
// DOWNLOAD ENDPOINTS
// ===========================================

/**
 * GET /api/orders/download/:token
 * Download endpoint with token validation - returns download info
 */
router.get(
  '/orders/download/:token',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const token = req.params.token as string;
    const order = await prisma.order.findUnique({
      where: { downloadToken: token },
      include: {
        customer: true,
        items: {
          include: { beat: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Download link not found');
    }

    if (order.paymentStatus !== 'PAID') {
      throw new ForbiddenError('Payment not completed');
    }

    // Check expiry for guests. The frontend keys off the `expired` boolean
    // in the response body to show a distinct "link expired" UI, so this
    // response is kept as a manual, non-standard-shaped body rather than a
    // thrown AppError (which would drop that field).
    if (order.customer.isGuest && order.downloadExpiresAt) {
      if (new Date() > order.downloadExpiresAt) {
        res.status(403).json({
          message:
            'Download link expired. Create an account to access your purchases.',
          expired: true,
        });
        return;
      }
    }

    // Update download count
    await prisma.order.update({
      where: { id: order.id },
      data: { downloadCount: { increment: 1 } },
    });

    // Return download info
    const downloads = order.items.map((item) => {
      const files: Array<{ type: string; url: string; filename: string }> =
        [];

      // MP3 always included
      if (item.beat.audioFile) {
        files.push({
          type: 'mp3',
          url: item.beat.audioFile,
          filename: `${item.beat.title} - ${item.licenseName}.mp3`,
        });
      }

      // WAV only for Unlimited license
      if (item.licenseType === 'UNLIMITED' && item.beat.wavFile) {
        files.push({
          type: 'wav',
          url: item.beat.wavFile,
          filename: `${item.beat.title} - ${item.licenseName}.wav`,
        });
      }

      return {
        beatId: item.beatId,
        beatTitle: item.beat.title,
        license: item.licenseName,
        files,
      };
    });

    res.json({
      orderNumber: order.orderNumber,
      downloads,
      expiresAt: order.downloadExpiresAt,
      downloadCount: order.downloadCount + 1,
    });
  })
);

/**
 * GET /api/orders/download/:token/:beatId/:fileType
 * Download specific file
 */
router.get(
  '/orders/download/:token/:beatId/:fileType',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const token = req.params.token as string;
    const beatId = req.params.beatId as string;
    const fileType = req.params.fileType as string;

    const order = await prisma.order.findUnique({
      where: { downloadToken: token },
      include: {
        customer: true,
        items: {
          where: { beatId: beatId },
          include: { beat: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Download link not found');
    }

    if (order.paymentStatus !== 'PAID') {
      throw new ForbiddenError('Payment not completed');
    }

    // Check expiry for guests
    if (order.customer.isGuest && order.downloadExpiresAt) {
      if (new Date() > order.downloadExpiresAt) {
        throw new ForbiddenError('Download link expired');
      }
    }

    const item = order.items[0];
    if (!item) {
      throw new NotFoundError('Beat not found in order');
    }

    // Validate file access based on license
    let filePath: string | null = null;
    if (fileType === 'mp3' && item.beat.audioFile) {
      filePath = path.join(process.cwd(), item.beat.audioFile);
    } else if (
      fileType === 'wav' &&
      item.licenseType === 'UNLIMITED' &&
      item.beat.wavFile
    ) {
      filePath = path.join(process.cwd(), item.beat.wavFile);
    } else {
      throw new ForbiddenError('File not available for your license');
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('File not found');
    }

    const filename = `${item.beat.title} - ${item.licenseName}.${fileType}`;
    res.download(filePath, filename);
  })
);

export default router;
