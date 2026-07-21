/**
 * Bookings Routes
 * Handles all booking-related API endpoints including:
 * - Availability checking (calendar slots)
 * - Promo deals
 * - Booking creation with Square payment
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { SquareClient, SquareEnvironment } from 'square';
import * as crypto from 'crypto';
import { config } from '../config/env';
import { authenticateToken, requireAdmin, paymentLimiter } from '../middleware';
import {
  asyncHandler,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalError,
} from '../middleware';
import { sendEmail } from '../services/email';
import { captureError } from '../services/sentry';
import { escapeHtml } from '../utils/text';
import { extractSquareError } from '../utils/square';

const router = Router();
const prisma = new PrismaClient();

/**
 * Timing-safe comparison for access tokens (e.g. Booking.rescheduleToken),
 * used to gate lookups keyed by a guessable/sequential public ID.
 */
export const isValidToken = (provided: string, expected: string): boolean => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

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

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Generate unique booking number
 */
async function generateBookingNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.booking.count({
    where: {
      createdAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  });
  const sequence = count + 1;
  return `BK-${year}-${sequence.toString().padStart(5, '0')}`;
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get start of day
 */
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Format date for display
 */
function formatDate(date: Date, formatStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const d = date.getDate();
  const m = date.getMonth();
  const y = date.getFullYear();
  const h = date.getHours();
  const min = date.getMinutes();
  const day = date.getDay();

  const h12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';

  return formatStr
    .replace('EEEE', days[day])
    .replace('MMMM', months[m])
    .replace('yyyy', y.toString())
    .replace('d', d.toString())
    .replace('h', h12.toString())
    .replace('mm', min.toString().padStart(2, '0'))
    .replace('a', ampm);
}

/**
 * Generate available time slots for a date range
 * Studio hours: 7 PM - 3 AM, 1-hour slots
 * Closed on Thursdays (4) and Sundays (0)
 */
function generateAvailabilitySlots(startDate: Date, endDate: Date): Array<{ startAt: string }> {
  const slots: Array<{ startAt: string }> = [];

  // Studio hours: 7 PM (19) to 3 AM (03)
  const eveningStartHour = 19; // 7 PM
  const eveningEndHour = 24;   // Midnight
  const nightStartHour = 0;    // Midnight
  const nightEndHour = 3;      // 3 AM

  let currentDate = startOfDay(startDate);
  const end = startOfDay(endDate);

  while (currentDate.getTime() <= end.getTime()) {
    // Skip past dates
    if (currentDate.getTime() < startOfDay(new Date()).getTime()) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const dayOfWeek = currentDate.getDay();

    // Skip Thursdays (4) and Sundays (0)
    if (dayOfWeek === 0 || dayOfWeek === 4) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    // Generate evening slots (7 PM - 11 PM)
    for (let hour = eveningStartHour; hour < eveningEndHour; hour++) {
      const slotTime = new Date(currentDate);
      slotTime.setHours(hour, 0, 0, 0);

      // Skip slots in the past
      if (slotTime.getTime() > Date.now()) {
        slots.push({
          startAt: slotTime.toISOString(),
        });
      }
    }

    // Generate late night slots (12 AM - 2 AM) - these are technically the next day
    const nextDay = addDays(currentDate, 1);
    const nextDayOfWeek = nextDay.getDay();

    // Don't generate late night slots if next day is Thursday or Sunday
    if (nextDayOfWeek !== 0 && nextDayOfWeek !== 4) {
      for (let hour = nightStartHour; hour < nightEndHour; hour++) {
        const slotTime = new Date(nextDay);
        slotTime.setHours(hour, 0, 0, 0);

        // Skip slots in the past
        if (slotTime.getTime() > Date.now()) {
          slots.push({
            startAt: slotTime.toISOString(),
          });
        }
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  // Sort slots by time and remove duplicates
  const uniqueSlots = Array.from(new Set(slots.map(s => s.startAt)))
    .sort()
    .map(startAt => ({ startAt }));

  return uniqueSlots;
}

// ===========================================
// AVAILABILITY ENDPOINTS
// ===========================================

interface AvailabilityRequest {
  sessionType: string;
  startDate: string;
  endDate: string;
}

/**
 * POST /api/bookings/availability
 * Get available time slots for booking
 */
router.post(
  '/availability',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.body as AvailabilityRequest;

    if (!startDate || !endDate) {
      throw new BadRequestError('startDate and endDate are required');
    }

    const start = new Date(startDate);
      const end = new Date(endDate);

      // Get existing confirmed bookings in the date range
      const existingBookings = await prisma.booking.findMany({
        where: {
          scheduledAt: {
            gte: start,
            lte: end,
          },
          status: {
            in: ['PENDING', 'CONFIRMED'],
          },
        },
      });

      // Generate all possible slots
      const allSlots = generateAvailabilitySlots(start, end);

      // Filter out slots that conflict with existing bookings
      const bookedTimes = new Set<string>();
      existingBookings.forEach((booking) => {
        if (booking.scheduledAt) {
          // Block the booked slot and subsequent hours based on booking duration
          const hours = booking.hours || 1;
          for (let i = 0; i < hours; i++) {
            const blockedTime = new Date(booking.scheduledAt);
            blockedTime.setHours(blockedTime.getHours() + i);
            bookedTimes.add(blockedTime.toISOString());
          }
        }
      });

      const availableSlots = allSlots.filter(
        (slot) => !bookedTimes.has(slot.startAt)
      );

      console.log(`[BOOKINGS] Generated ${availableSlots.length} available slots from ${startDate} to ${endDate}`);

    res.json({
      availabilities: availableSlots,
      totalSlots: availableSlots.length,
    });
  })
);

// ===========================================
// PROMOS ENDPOINTS
// ===========================================

/**
 * GET /api/bookings/promos
 * Get active promo deals
 */
router.get(
  '/promos',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const now = new Date();

    const promos = await prisma.promo.findMany({
      where: {
        active: true,
        OR: [
          { validFrom: null, validUntil: null },
          {
            validFrom: { lte: now },
            validUntil: { gte: now },
          },
          {
            validFrom: { lte: now },
            validUntil: null,
          },
          {
            validFrom: null,
            validUntil: { gte: now },
          },
        ],
      },
      orderBy: { price: 'asc' },
    });

    res.json(promos);
  })
);

// ===========================================
// SERVER-SIDE PRICING
// ===========================================
// Mirrors frontend/src/pages/BookPage.tsx's calculatePayment(). The client
// only ever sends the *inputs* (category/hours/tier/etc) - price and
// deposit are always computed here so a modified request can't set an
// arbitrary charge amount.

interface MixingTierConfig {
  id: string;
  price: number;
  allowInPerson: boolean;
}

const MIXING_TIERS: MixingTierConfig[] = [
  { id: 'BASIC', price: 75, allowInPerson: false },
  { id: 'STANDARD', price: 100, allowInPerson: false },
  { id: 'PRO', price: 200, allowInPerson: true },
  { id: 'PREMIUM', price: 300, allowInPerson: true },
];

interface MasteringTierConfig {
  id: string;
  price: number;
}

// Mastering is remote-only (no in-person delivery option, unlike Mixing).
const MASTERING_TIERS: MasteringTierConfig[] = [
  { id: 'DIGITAL', price: 75 },
  { id: 'ANALOG', price: 125 },
];

const CONSULTING_PRICES: Record<string, number> = {
  '30min': 50,
  '60min': 85,
};

const DEFAULT_DEPOSIT = 25;
const IN_PERSON_MIXING_STUDIO_HOURS = 2;
const IN_PERSON_MIXING_HOURLY_RATE = 80;

/**
 * GET /api/bookings/pricing-config
 * Returns the pricing constants used by calculateBookingPrice() below, so
 * the frontend can display accurate prices without maintaining its own
 * hardcoded copy that can drift out of sync with what's actually charged.
 */
router.get(
  '/pricing-config',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    res.json({
      deposit: DEFAULT_DEPOSIT,
      recording: {
        rateUnder5Hours: 80,
        rate5to9Hours: 70,
        rate10PlusHours: 65,
      },
      mixing: {
        tiers: Object.fromEntries(MIXING_TIERS.map((t) => [t.id, t.price])),
        inPersonStudioHours: IN_PERSON_MIXING_STUDIO_HOURS,
        inPersonHourlyRate: IN_PERSON_MIXING_HOURLY_RATE,
      },
      mastering: {
        tiers: Object.fromEntries(MASTERING_TIERS.map((t) => [t.id, t.price])),
      },
      consulting: CONSULTING_PRICES,
    });
  })
);

interface BookingPricingInput {
  category: string;
  hours?: number;
  mixingTier?: string;
  mixingDelivery?: string;
  masteringTier?: string;
  consultingDuration?: string;
  promoId?: string;
}

interface BookingPricingResult {
  deposit: number;
  total: number;
}

/**
 * Computes the deposit/total for a booking from server-trusted inputs.
 * Returns null if the combination of inputs doesn't resolve to a valid,
 * known price (caller should reject the booking in that case).
 *
 * TODO(tax): no sales tax is calculated or collected on studio services
 * here. Confirm with an accountant whether these services are taxable
 * before adding it - this is a compliance decision, not just a missing
 * feature.
 */
async function calculateBookingPrice(
  input: BookingPricingInput
): Promise<BookingPricingResult | null> {
  const { category, hours, mixingTier, mixingDelivery, masteringTier, consultingDuration, promoId } = input;

  if (category === 'recording') {
    if (!hours || hours < 1) return null;
    const rate = hours >= 10 ? 65 : hours >= 5 ? 70 : 80;
    return { deposit: DEFAULT_DEPOSIT, total: hours * rate };
  }

  if (category === 'mixing') {
    const tier = MIXING_TIERS.find((t) => t.id === mixingTier);
    if (!tier) return null;

    if (mixingDelivery === 'in-person') {
      if (!tier.allowInPerson) return null;
      const total =
        tier.price + IN_PERSON_MIXING_STUDIO_HOURS * IN_PERSON_MIXING_HOURLY_RATE;
      return { deposit: DEFAULT_DEPOSIT, total };
    }

    return { deposit: tier.price, total: tier.price };
  }

  if (category === 'mastering') {
    const tier = MASTERING_TIERS.find((t) => t.id === masteringTier);
    if (!tier) return null;
    return { deposit: tier.price, total: tier.price };
  }

  if (category === 'promo') {
    if (!promoId) return null;
    const promo = await prisma.promo.findUnique({ where: { id: promoId } });
    if (!promo || !promo.active) return null;
    return { deposit: DEFAULT_DEPOSIT, total: promo.price };
  }

  if (category === 'consulting') {
    const price = consultingDuration ? CONSULTING_PRICES[consultingDuration] : undefined;
    if (price === undefined) return null;
    return { deposit: price, total: price };
  }

  return null;
}

// ===========================================
// BOOKING CREATION
// ===========================================

interface BookingCreateRequest {
  category: 'recording' | 'mixing' | 'mastering' | 'promo' | 'consulting';
  hours?: number;
  mixingTier?: string;
  mixingDelivery?: string;
  masteringTier?: string;
  consultingDuration?: string;
  promoId?: string;
  beatId?: string;
  startAt?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    artistName?: string;
    songTitle?: string;
    recordingDetails?: string;
  };
  sourceId: string;
}

/**
 * POST /api/bookings/create
 * Create a new booking with Square payment
 */
router.post(
  '/create',
  paymentLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      category,
      hours,
      mixingTier,
      mixingDelivery,
      masteringTier,
      consultingDuration,
      promoId,
      beatId,
      startAt,
      customer,
      sourceId,
    } = req.body as BookingCreateRequest;

    // Validate required fields
    if (!customer?.name || !customer?.email || !customer?.phone) {
      throw new BadRequestError('Customer name, email, and phone are required');
    }

    if (!sourceId) {
      throw new BadRequestError('Payment source is required');
    }

    // Price is always computed server-side from the booking inputs -
    // never trust a client-submitted amount for what gets charged.
    const pricing = await calculateBookingPrice({
      category,
      hours,
      mixingTier,
      mixingDelivery,
      masteringTier,
      consultingDuration,
      promoId,
    });

    if (!pricing) {
      throw new BadRequestError('Invalid booking selection - could not determine price');
    }

    const depositAmount = pricing.deposit;
    const totalAmount = pricing.total;

    // Generate booking number
    const bookingNumber = await generateBookingNumber();

    // Calculate balance
    const balanceAmount = totalAmount - depositAmount;

    // Find or create customer
    let existingCustomer = await prisma.customer.findUnique({
      where: { email: customer.email },
    });

    if (!existingCustomer) {
      const nameParts = customer.name.split(' ');
      existingCustomer = await prisma.customer.create({
        data: {
          email: customer.email,
          firstName: nameParts[0] || null,
          lastName: nameParts.slice(1).join(' ') || null,
          phone: customer.phone,
          stageName: customer.artistName || null,
          isGuest: true,
        },
      });
    }

    // The Square payment call and everything that follows it are wrapped in
    // their own try/catch (rather than relying on the outer asyncHandler)
    // because Square failures need a bespoke, user-facing response derived
    // from Square's error shape - the centralized handler's generic body
    // would lose that detail. Genuine unexpected/internal failures still
    // fall through to a thrown InternalError so the raw error message is
    // never leaked to the client.
    try {
      // Process deposit payment with Square
      console.log('[BOOKINGS] Processing deposit payment:', depositAmount * 100, 'cents');

      const idempotencyKey = `booking-${bookingNumber}-${Date.now()}`;

      const paymentResponse = await squareClient.payments.create({
        sourceId: sourceId,
        idempotencyKey: idempotencyKey,
        amountMoney: {
          amount: BigInt(Math.round(depositAmount * 100)),
          currency: 'USD',
        },
        locationId: config.square.locationId,
        note: `Booking ${bookingNumber} - ${category} deposit`,
        referenceId: bookingNumber,
      });

      if (paymentResponse.payment?.status !== 'COMPLETED') {
        console.error('[BOOKINGS] Payment not completed:', paymentResponse.payment?.status);
        res.status(400).json({
          message: 'Payment was not completed',
          status: paymentResponse.payment?.status,
        });
        return;
      }

      console.log('[BOOKINGS] Payment successful:', paymentResponse.payment.id);

      // Create booking record
      const booking = await prisma.booking.create({
        data: {
          bookingNumber,
          customerId: existingCustomer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          artistName: customer.artistName,
          songTitle: customer.songTitle,
          recordingDetails: customer.recordingDetails,
          category: category.toUpperCase(),
          hours: hours || null,
          // mixingTier also stores the mastering tier (DIGITAL/ANALOG) for
          // MASTERING bookings - a booking is only ever one category, so
          // reusing this column avoids a schema migration for a second,
          // mutually-exclusive tier field.
          mixingTier: mixingTier || masteringTier || null,
          mixingDelivery: mixingDelivery || null,
          promoId: promoId || null,
          beatId: beatId || null,
          scheduledAt: startAt ? new Date(startAt) : null,
          sessionPrice: totalAmount,
          depositAmount: depositAmount,
          depositPaid: true,
          depositPaymentId: paymentResponse.payment.id,
          depositPaidAt: new Date(),
          balanceAmount: balanceAmount,
          status: 'CONFIRMED',
        },
      });

      // Send confirmation email to customer
      await sendBookingConfirmationEmail(booking);

      // Send notification email to admin
      await sendAdminNotificationEmail(booking);

      res.json({
        success: true,
        bookingNumber: booking.bookingNumber,
        paymentId: paymentResponse.payment.id,
        message: 'Booking confirmed!',
      });
    } catch (error) {
      console.error('[BOOKINGS] Error creating booking:', error);
      captureError(error, { bookingNumber, context: 'booking-create' });

      // Handle Square API errors
      const firstError = extractSquareError(error);
      if (firstError) {
        res.status(400).json({
          success: false,
          message: firstError.detail || 'Payment failed',
          code: firstError.code,
        });
        return;
      }

      throw new InternalError('Failed to create booking');
    }
  })
);

// ===========================================
// EMAIL FUNCTIONS
// ===========================================

interface BookingForEmail {
  bookingNumber: string;
  rescheduleToken: string;
  category: string;
  hours: number | null;
  mixingTier: string | null;
  mixingDelivery: string | null;
  scheduledAt: Date | null;
  depositAmount: number;
  balanceAmount: number;
  sessionPrice: number;
  name: string;
  email: string;
  artistName: string | null;
}

async function sendBookingConfirmationEmail(booking: BookingForEmail): Promise<void> {
  const scheduledDate = booking.scheduledAt
    ? formatDate(booking.scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a")
    : 'To be scheduled';

  let serviceDetails = '';
  if (booking.category === 'RECORDING') {
    serviceDetails = `${booking.hours || 1} Hour Recording Session`;
  } else if (booking.category === 'MIXING') {
    serviceDetails = `${booking.mixingTier || 'Standard'} Mixing Service`;
  } else if (booking.category === 'MASTERING') {
    serviceDetails = `${booking.mixingTier || 'Digital'} Mastering Service`;
  } else if (booking.category === 'PROMO') {
    serviceDetails = 'Promo Package';
  } else if (booking.category === 'CONSULTING') {
    serviceDetails = 'Consultation Call';
  }

  const mailOptions = {
    to: booking.email,
    subject: `Booking Confirmed! #${booking.bookingNumber} - Doc Rolds Studio`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 30px;">
        <h1 style="color: #E83628; text-align: center;">Booking Confirmed!</h1>

        <p>Hey ${escapeHtml(booking.name)},</p>
        <p>Your booking has been confirmed. Here are the details:</p>

        <div style="background: #222; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #E83628; margin-top: 0;">Booking Details</h3>
          <table style="width: 100%; color: #fff;">
            <tr>
              <td style="padding: 8px 0; color: #999;">Booking #:</td>
              <td style="padding: 8px 0;"><strong>${booking.bookingNumber}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">Service:</td>
              <td style="padding: 8px 0;">${serviceDetails}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">Date & Time:</td>
              <td style="padding: 8px 0;">${scheduledDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">Deposit Paid:</td>
              <td style="padding: 8px 0; color: #4CAF50;">$${booking.depositAmount.toFixed(2)} ✓</td>
            </tr>
            ${booking.balanceAmount > 0 ? `
            <tr>
              <td style="padding: 8px 0; color: #999;">Balance Due:</td>
              <td style="padding: 8px 0;">$${booking.balanceAmount.toFixed(2)} (at studio)</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; color: #999;">Total:</td>
              <td style="padding: 8px 0;"><strong>$${booking.sessionPrice.toFixed(2)}</strong></td>
            </tr>
          </table>
        </div>

        <div style="background: #E83628; color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; text-align: center;">${booking.category === 'CONSULTING' ? 'Session Information' : 'Studio Information'}</h3>
          <table style="width: 100%; color: #fff; font-size: 14px;">
            ${(booking.category === 'RECORDING' || (booking.category === 'MIXING' && booking.mixingDelivery === 'in-person')) ? `
            <tr>
              <td style="padding: 8px 0; color: rgba(255,255,255,0.8);">Location:</td>
              <td style="padding: 8px 0;">
                <a href="https://www.google.com/maps/dir/?api=1&destination=11100+66th+St+N+Suite+20,+Largo,+FL+33773"
                   target="_blank"
                   style="color: #fff; text-decoration: none;">
                  <strong>Summit Audio Recording Studio</strong><br>
                  <span style="font-size: 12px; text-decoration: underline;">11100 66th St N Suite 20<br>Largo, FL 33773</span>
                  <span style="font-size: 11px; display: block; margin-top: 4px; opacity: 0.8;">📍 Tap for directions</span>
                </a>
              </td>
            </tr>
            ` : ''}
            ${((booking.category === 'MIXING' && booking.mixingDelivery === 'remote') || booking.category === 'MASTERING') ? `
            <tr>
              <td style="padding: 8px 0; color: rgba(255,255,255,0.8);">Delivery:</td>
              <td style="padding: 8px 0;"><strong>Remote</strong><br><span style="font-size: 12px;">Files will be delivered via email</span></td>
            </tr>
            ` : ''}
            ${booking.category === 'CONSULTING' ? `
            <tr>
              <td style="padding: 8px 0; color: rgba(255,255,255,0.8);">Format:</td>
              <td style="padding: 8px 0;"><strong>Virtual Session</strong><br><span style="font-size: 12px;">Call details will be sent before your session</span></td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; color: rgba(255,255,255,0.8);">Engineer:</td>
              <td style="padding: 8px 0;"><strong>Doc Rolds</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: rgba(255,255,255,0.8);">Contact:</td>
              <td style="padding: 8px 0;">
                <a href="tel:+17272825449" style="color: #fff; text-decoration: none;">
                  <strong style="text-decoration: underline;">(727) 282-5449</strong>
                  <span style="font-size: 11px; display: block; margin-top: 2px; opacity: 0.8;">📞 Tap to call</span>
                </a>
              </td>
            </tr>
          </table>
        </div>

        <div style="background: #222; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <h4 style="color: #fff; margin: 0 0 10px 0; font-size: 14px;">Booking Terms</h4>
          <ul style="color: #999; font-size: 12px; margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 5px;">No cancellations within 24 hours of session</li>
            <li style="margin-bottom: 5px;">Deposits are non-refundable</li>
            <li>Reschedules must be made 24+ hours in advance</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 25px 0;">
          <p style="color: #999; font-size: 12px; margin-bottom: 10px;">Need to reschedule?</p>
          <a href="${config.frontendUrl}/reschedule/${booking.bookingNumber}?key=${booking.rescheduleToken}"
             style="display: inline-block; background: #333; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            Reschedule Booking
          </a>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
          Questions? Call us at <a href="tel:+17272825449" style="color: #fff; font-weight: bold;">(727) 282-5449</a> or reply to this email
        </p>

        <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">

        <p style="color: #999; font-size: 12px; text-align: center;">
          Doc Rolds Music - <a href="${config.frontendUrl}" style="color: #E83628;">docrolds.com</a>
        </p>
      </div>
    `,
  };

  try {
    await sendEmail(mailOptions);
    console.log('[BOOKINGS] Confirmation email sent to:', booking.email);

    // Update booking record
    await prisma.booking.update({
      where: { bookingNumber: booking.bookingNumber },
      data: {
        confirmationSent: true,
        confirmationSentAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[BOOKINGS] Failed to send confirmation email:', (error as Error).message);
    captureError(error, { bookingNumber: booking.bookingNumber, context: 'booking-confirmation-email' });
  }
}

async function sendBookingReminderEmail(booking: BookingForEmail): Promise<void> {
  const scheduledDate = booking.scheduledAt
    ? formatDate(booking.scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a")
    : 'To be scheduled';

  const mailOptions = {
    to: booking.email,
    subject: `Reminder: Your session is tomorrow - #${booking.bookingNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 30px;">
        <h1 style="color: #E83628; text-align: center;">See you soon!</h1>

        <p>Hey ${escapeHtml(booking.name)},</p>
        <p>Just a reminder that your session at Doc Rolds Studio is coming up:</p>

        <div style="background: #222; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; color: #fff;">
            <tr>
              <td style="padding: 8px 0; color: #999;">Booking #:</td>
              <td style="padding: 8px 0;"><strong>${booking.bookingNumber}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">Date & Time:</td>
              <td style="padding: 8px 0;"><strong>${scheduledDate}</strong></td>
            </tr>
            ${booking.balanceAmount > 0 ? `
            <tr>
              <td style="padding: 8px 0; color: #999;">Balance Due:</td>
              <td style="padding: 8px 0;">$${booking.balanceAmount.toFixed(2)} (at studio)</td>
            </tr>
            ` : ''}
          </table>
        </div>

        ${(booking.category === 'RECORDING' || (booking.category === 'MIXING' && booking.mixingDelivery === 'in-person')) ? `
        <div style="background: #E83628; color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <a href="https://www.google.com/maps/dir/?api=1&destination=11100+66th+St+N+Suite+20,+Largo,+FL+33773"
             target="_blank"
             style="color: #fff; text-decoration: none;">
            <strong>Summit Audio Recording Studio</strong><br>
            <span style="font-size: 12px; text-decoration: underline;">11100 66th St N Suite 20, Largo, FL 33773</span><br>
            <span style="font-size: 11px; opacity: 0.8;">📍 Tap for directions</span>
          </a>
        </div>
        ` : ''}

        ${(booking.category === 'MIXING' || booking.category === 'MASTERING') ? `
        <div style="text-align: center; margin: 25px 0;">
          <p style="color: #999; font-size: 12px; margin-bottom: 10px;">Ready to send us your tracks?</p>
          <a href="${config.frontendUrl}/booking/${booking.bookingNumber}/stems?key=${booking.rescheduleToken}"
             style="display: inline-block; background: #E83628; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            Upload Your Stems
          </a>
        </div>
        ` : ''}

        <div style="text-align: center; margin: 25px 0;">
          <p style="color: #999; font-size: 12px; margin-bottom: 10px;">Can't make it?</p>
          <a href="${config.frontendUrl}/reschedule/${booking.bookingNumber}?key=${booking.rescheduleToken}"
             style="display: inline-block; background: #333; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            Reschedule Booking
          </a>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
          Questions? Call us at <a href="tel:+17272825449" style="color: #fff; font-weight: bold;">(727) 282-5449</a>
        </p>

        <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">

        <p style="color: #999; font-size: 12px; text-align: center;">
          Doc Rolds Music - <a href="${config.frontendUrl}" style="color: #E83628;">docrolds.com</a>
        </p>
      </div>
    `,
  };

  await sendEmail(mailOptions);
}

/**
 * Sends session reminders for bookings scheduled roughly 24 hours out.
 * Called both by an in-process interval (index.ts) and by the manual
 * admin-triggered endpoint below, so it must be safe to call concurrently -
 * each booking is atomically claimed (a conditional update that only
 * succeeds if reminderSent is still false) before sending, so two
 * overlapping sweeps can't both send the same reminder. A send that fails
 * after a successful claim won't retry on the next sweep - a duplicate
 * reminder is worse than an occasional missed one, which can still be
 * triggered manually via this same function/endpoint.
 */
export async function sendPendingBookingReminders(): Promise<{ sent: number; failed: number }> {
  const windowStart = new Date(Date.now() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(Date.now() + 25 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ['PENDING', 'CONFIRMED'] },
      reminderSent: false,
      scheduledAt: { gte: windowStart, lte: windowEnd },
    },
  });

  let sent = 0;
  let failed = 0;

  for (const booking of bookings) {
    const claim = await prisma.booking.updateMany({
      where: { id: booking.id, reminderSent: false },
      data: { reminderSent: true, reminderSentAt: new Date() },
    });

    if (claim.count === 0) {
      // Another concurrent sweep already claimed this booking.
      continue;
    }

    try {
      await sendBookingReminderEmail(booking);
      sent++;
      console.log('[BOOKINGS] Reminder sent:', booking.bookingNumber);
    } catch (error) {
      failed++;
      console.error('[BOOKINGS] Failed to send reminder:', booking.bookingNumber, (error as Error).message);
      captureError(error, { bookingNumber: booking.bookingNumber, context: 'booking-reminder-email' });
    }
  }

  return { sent, failed };
}

/**
 * POST /api/bookings/send-reminders
 * Manually trigger the reminder sweep (admin only). Also called on a
 * recurring interval from index.ts - this endpoint exists so reminders
 * can still go out via an external pinger if the web service has been
 * idle and the in-process interval hasn't been running.
 */
router.post(
  '/send-reminders',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const result = await sendPendingBookingReminders();
    res.json({ success: true, ...result });
  })
);

// ===========================================
// ADMIN ENDPOINTS
// ===========================================

/**
 * GET /api/bookings
 * Get all bookings (admin)
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, startDate, endDate } = req.query;

    interface WhereClause {
      status?: string;
      scheduledAt?: {
        gte: Date;
        lte: Date;
      };
    }

    const where: WhereClause = {};

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (startDate && endDate) {
      where.scheduledAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        customer: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        promo: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    res.json(bookings);
  })
);

/**
 * GET /api/bookings/:id
 * Get single booking by ID
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        promo: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    res.json(booking);
  })
);

/**
 * PUT /api/bookings/:id/status
 * Update booking status (admin)
 */
router.put(
  '/:id/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { status, notes } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestError('Invalid status');
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        status,
        notes: notes || undefined,
      },
    });

    res.json(booking);
  })
);

interface RefundBookingRequest {
  reason?: string;
}

/**
 * POST /api/bookings/:id/refund
 * Refund a booking's deposit via Square (admin only). Only refunds the
 * deposit - the in-studio balance payment (if any) isn't tracked by this
 * system and has no corresponding Square payment ID to refund here.
 */
router.post(
  '/:id/refund',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { reason } = req.body as RefundBookingRequest;

    const booking = await prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (!booking.depositPaid || !booking.depositPaymentId) {
      throw new BadRequestError('Booking has no paid deposit to refund');
    }

    if (booking.status === 'CANCELLED' && !booking.depositPaid) {
      throw new ConflictError('Booking deposit has already been refunded');
    }

    try {
      const refundResponse = await squareClient.refunds.refundPayment({
        idempotencyKey: `booking-refund-${booking.id}`,
        paymentId: booking.depositPaymentId,
        amountMoney: {
          amount: BigInt(Math.round(booking.depositAmount * 100)),
          currency: 'USD',
        },
        reason: reason || `Deposit refund for booking ${booking.bookingNumber}`,
      });

      if (
        refundResponse.refund?.status === 'REJECTED' ||
        refundResponse.refund?.status === 'FAILED'
      ) {
        throw new InternalError(
          `Square rejected the refund: ${refundResponse.refund.status}`
        );
      }

      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED', depositPaid: false },
      });

      console.log(
        `[REFUND] Booking ${booking.bookingNumber} deposit refunded by admin, Square refund ID:`,
        refundResponse.refund?.id
      );

      try {
        await sendEmail({
          to: booking.email,
          subject: `Deposit Refunded - Booking #${booking.bookingNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 30px;">
              <h1 style="color: #E83628; text-align: center;">Deposit Refunded</h1>
              <p>Hey ${escapeHtml(booking.name)},</p>
              <p>Your deposit for booking <strong>#${booking.bookingNumber}</strong> has been refunded, and the booking has been cancelled.</p>
              <div style="background: #222; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; color: #fff;">
                  <tr>
                    <td style="padding: 8px 0; color: #999;">Booking #:</td>
                    <td style="padding: 8px 0;"><strong>${booking.bookingNumber}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #999;">Amount Refunded:</td>
                    <td style="padding: 8px 0;"><strong>$${booking.depositAmount.toFixed(2)}</strong></td>
                  </tr>
                </table>
              </div>
              <p style="color: #999; font-size: 13px;">Funds typically appear back on your original payment method within 5-10 business days, depending on your bank.</p>
              <p>Want to book another session? Head back to <a href="${config.frontendUrl}/book" style="color: #E83628;">docrolds.com/book</a> anytime.</p>
              <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                Questions? Call us at <a href="tel:+17272825449" style="color: #fff; font-weight: bold;">(727) 282-5449</a>
              </p>
              <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">
              <p style="color: #999; font-size: 12px; text-align: center;">
                Doc Rolds Music - <a href="${config.frontendUrl}" style="color: #E83628;">docrolds.com</a>
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('[REFUND] Failed to send refund confirmation email:', (emailError as Error).message);
        captureError(emailError, { bookingNumber: booking.bookingNumber, context: 'booking-refund-email' });
      }

      res.json({
        success: true,
        bookingNumber: booking.bookingNumber,
        refundId: refundResponse.refund?.id,
        status: refundResponse.refund?.status,
      });
    } catch (error) {
      if (error instanceof InternalError) throw error;

      console.error('[REFUND] Error refunding booking:', error);
      captureError(error, { bookingNumber: booking.bookingNumber, context: 'admin-refund-booking' });

      const firstError = extractSquareError(error);
      if (firstError) {
        throw new BadRequestError(firstError.detail || 'Refund failed', firstError.code);
      }

      throw new InternalError('Failed to process refund');
    }
  })
);

// ===========================================
// RESCHEDULE ENDPOINTS
// ===========================================

/**
 * GET /api/bookings/reschedule/:bookingNumber
 * Get booking details for reschedule (public - accessed via email link)
 * Requires a matching ?key= reschedule token since bookingNumber is
 * sequential and guessable; the token is not.
 */
router.get(
  '/reschedule/:bookingNumber',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const bookingNumber = req.params.bookingNumber as string;
    const key = typeof req.query.key === 'string' ? req.query.key : undefined;

    if (!key) {
      throw new BadRequestError('Missing reschedule key');
    }

    const booking = await prisma.booking.findUnique({
      where: { bookingNumber },
      select: {
        id: true,
        bookingNumber: true,
        rescheduleToken: true,
        name: true,
        email: true,
        category: true,
        hours: true,
        mixingTier: true,
        scheduledAt: true,
        status: true,
        sessionPrice: true,
        depositAmount: true,
        balanceAmount: true,
      },
    });

    if (!booking || !isValidToken(key, booking.rescheduleToken)) {
      throw new NotFoundError('Booking not found');
    }

    // Can't reschedule completed or cancelled bookings
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot reschedule a ${booking.status.toLowerCase()} booking`);
    }

    // Check 24-hour rule
    if (booking.scheduledAt) {
      const hoursUntilSession = (booking.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilSession < 24) {
        throw new BadRequestError(
          `Cannot reschedule within 24 hours of your session (${Math.max(0, hoursUntilSession).toFixed(1)} hours remaining)`
        );
      }
    }

    const { rescheduleToken: _rescheduleToken, ...bookingResponse } = booking;
    res.json(bookingResponse);
  })
);

/**
 * PUT /api/bookings/reschedule/:bookingNumber
 * Reschedule a booking to a new time
 */
router.put(
  '/reschedule/:bookingNumber',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const bookingNumber = req.params.bookingNumber as string;
    const { newDateTime, email } = req.body;
    const key = typeof req.query.key === 'string' ? req.query.key : undefined;

    if (!newDateTime) {
      throw new BadRequestError('New date/time is required');
    }

    if (!key) {
      throw new BadRequestError('Missing reschedule key');
    }

    const booking = await prisma.booking.findUnique({
      where: { bookingNumber },
    });

    if (!booking || !isValidToken(key, booking.rescheduleToken)) {
      throw new NotFoundError('Booking not found');
    }

    // Verify email matches (simple security)
    if (email && booking.email.toLowerCase() !== email.toLowerCase()) {
      throw new ForbiddenError('Email does not match booking');
    }

    // Can't reschedule completed or cancelled bookings
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot reschedule a ${booking.status.toLowerCase()} booking`);
    }

    // Check 24-hour rule for current booking
    if (booking.scheduledAt) {
      const hoursUntilSession = (booking.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilSession < 24) {
        throw new BadRequestError('Cannot reschedule within 24 hours of your session');
      }
    }

    // Verify new time is in the future
    const newTime = new Date(newDateTime);
    if (newTime.getTime() <= Date.now()) {
      throw new BadRequestError('New time must be in the future');
    }

    // Check if new slot is available
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        scheduledAt: newTime,
        status: { in: ['PENDING', 'CONFIRMED'] },
        id: { not: booking.id },
      },
    });

    if (conflictingBooking) {
      throw new BadRequestError('This time slot is no longer available');
    }

    // Update the booking
    const updatedBooking = await prisma.booking.update({
      where: { bookingNumber },
      data: {
        scheduledAt: newTime,
        notes: booking.notes
          ? `${booking.notes}\nRescheduled from ${booking.scheduledAt?.toISOString()} on ${new Date().toISOString()}`
          : `Rescheduled from ${booking.scheduledAt?.toISOString()} on ${new Date().toISOString()}`,
      },
    });

    // Send reschedule confirmation email
    await sendRescheduleEmail(updatedBooking, booking.scheduledAt);

    console.log(`[BOOKINGS] Booking ${bookingNumber} rescheduled to ${newTime.toISOString()}`);

    res.json({
      success: true,
      message: 'Booking rescheduled successfully',
      newDateTime: newTime.toISOString(),
    });
  })
);

/**
 * Send reschedule confirmation email
 */
async function sendRescheduleEmail(
  booking: { bookingNumber: string; name: string; email: string; scheduledAt: Date | null },
  previousTime: Date | null
): Promise<void> {
  const newDate = booking.scheduledAt
    ? formatDate(booking.scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a")
    : 'To be confirmed';

  const oldDate = previousTime
    ? formatDate(previousTime, "EEEE, MMMM d, yyyy 'at' h:mm a")
    : 'Unknown';

  const mailOptions = {
    to: booking.email,
    subject: `Booking Rescheduled - #${booking.bookingNumber} - Doc Rolds Studio`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 30px;">
        <h1 style="color: #E83628; text-align: center;">Booking Rescheduled</h1>

        <p>Hey ${booking.name},</p>
        <p>Your session has been rescheduled. Here are the updated details:</p>

        <div style="background: #222; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; color: #fff;">
            <tr>
              <td style="padding: 8px 0; color: #999;">Booking #:</td>
              <td style="padding: 8px 0;"><strong>${booking.bookingNumber}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">Previous Time:</td>
              <td style="padding: 8px 0; text-decoration: line-through; opacity: 0.6;">${oldDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">New Time:</td>
              <td style="padding: 8px 0; color: #10b981;"><strong>${newDate}</strong></td>
            </tr>
          </table>
        </div>

        <a href="https://www.google.com/maps/dir/?api=1&destination=11100+66th+St+N+Suite+20,+Largo,+FL+33773"
           target="_blank"
           style="display: block; background: #E83628; color: #fff; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; text-decoration: none;">
          <strong>Summit Audio Recording Studio</strong><br>
          <span style="font-size: 12px; text-decoration: underline;">11100 66th St N Suite 20, Largo, FL 33773</span><br>
          <span style="font-size: 11px; opacity: 0.8;">📍 Tap for directions</span>
        </a>

        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
          Questions? Call us at <a href="tel:+17272825449" style="color: #fff; font-weight: bold;">(727) 282-5449</a>
        </p>
      </div>
    `,
  };

  try {
    await sendEmail(mailOptions);
    console.log('[BOOKINGS] Reschedule email sent to:', booking.email);
  } catch (error) {
    console.error('[BOOKINGS] Failed to send reschedule email:', (error as Error).message);
    captureError(error, { bookingNumber: booking.bookingNumber, context: 'booking-reschedule-email' });
  }
}

/**
 * Send admin notification email when new booking is created
 */
async function sendAdminNotificationEmail(booking: BookingForEmail): Promise<void> {
  const scheduledDate = booking.scheduledAt
    ? formatDate(booking.scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a")
    : 'To be scheduled';

  let serviceDetails = '';
  if (booking.category === 'RECORDING') {
    serviceDetails = `${booking.hours || 1} Hour Recording Session`;
  } else if (booking.category === 'MIXING') {
    serviceDetails = `${booking.mixingTier || 'Standard'} Mixing Service`;
  } else if (booking.category === 'MASTERING') {
    serviceDetails = `${booking.mixingTier || 'Digital'} Mastering Service`;
  } else if (booking.category === 'PROMO') {
    serviceDetails = 'Promo Package';
  } else if (booking.category === 'CONSULTING') {
    serviceDetails = 'Consultation Call';
  }

  const adminEmail = config.email.user; // Send to the same email that sends

  const mailOptions = {
    to: adminEmail,
    subject: `🎵 New Booking! #${booking.bookingNumber} - ${escapeHtml(booking.name)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 30px;">
        <h1 style="color: #10b981; text-align: center;">New Booking Received!</h1>

        <div style="background: #222; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #E83628; margin-top: 0;">Customer Details</h3>
          <table style="width: 100%; color: #fff;">
            <tr>
              <td style="padding: 8px 0; color: #999;">Name:</td>
              <td style="padding: 8px 0;"><strong>${escapeHtml(booking.name)}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${encodeURIComponent(booking.email)}" style="color: #E83628;">${escapeHtml(booking.email)}</a></td>
            </tr>
            ${booking.artistName ? `
            <tr>
              <td style="padding: 8px 0; color: #999;">Artist Name:</td>
              <td style="padding: 8px 0;">${escapeHtml(booking.artistName)}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="background: #222; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #E83628; margin-top: 0;">Booking Details</h3>
          <table style="width: 100%; color: #fff;">
            <tr>
              <td style="padding: 8px 0; color: #999;">Booking #:</td>
              <td style="padding: 8px 0;"><strong>${booking.bookingNumber}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">Service:</td>
              <td style="padding: 8px 0;">${serviceDetails}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999;">Date & Time:</td>
              <td style="padding: 8px 0; color: #10b981;"><strong>${scheduledDate}</strong></td>
            </tr>
          </table>
        </div>

        <div style="background: #10b981; color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; text-align: center;">Payment Received</h3>
          <table style="width: 100%; color: #fff; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0;">Deposit:</td>
              <td style="padding: 8px 0; text-align: right;"><strong>$${booking.depositAmount.toFixed(2)} ✓</strong></td>
            </tr>
            ${booking.balanceAmount > 0 ? `
            <tr>
              <td style="padding: 8px 0;">Balance Due:</td>
              <td style="padding: 8px 0; text-align: right;">$${booking.balanceAmount.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.3);">Total:</td>
              <td style="padding: 8px 0; text-align: right; border-top: 1px solid rgba(255,255,255,0.3);"><strong>$${booking.sessionPrice.toFixed(2)}</strong></td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${config.frontendUrl}/admin/bookings"
             style="display: inline-block; background: #E83628; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: bold;">
            View in Admin Dashboard
          </a>
        </div>

        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
          This is an automated notification from Doc Rolds Booking System
        </p>
      </div>
    `,
  };

  try {
    await sendEmail(mailOptions);
    console.log('[BOOKINGS] Admin notification email sent');
  } catch (error) {
    console.error('[BOOKINGS] Failed to send admin notification:', (error as Error).message);
    captureError(error, { context: 'booking-admin-notification-email' });
  }
}

export default router;
