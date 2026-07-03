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
import { authenticateToken, requireAdmin } from '../middleware';
import { sendEmail } from '../services/email';

const router = Router();
const prisma = new PrismaClient();

/**
 * Timing-safe comparison for access tokens (e.g. Booking.rescheduleToken),
 * used to gate lookups keyed by a guessable/sequential public ID.
 */
const isValidToken = (provided: string, expected: string): boolean => {
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
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.body as AvailabilityRequest;

      if (!startDate || !endDate) {
        res.status(400).json({ message: 'startDate and endDate are required' });
        return;
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
    } catch (error) {
      console.error('[BOOKINGS] Error fetching availability:', error);
      res.status(500).json({
        message: 'Failed to fetch availability',
        error: (error as Error).message,
      });
    }
  }
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
  async (_req: Request, res: Response): Promise<void> => {
    try {
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
    } catch (error) {
      console.error('[BOOKINGS] Error fetching promos:', error);
      res.status(500).json({
        message: 'Failed to fetch promos',
        error: (error as Error).message,
      });
    }
  }
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

const CONSULTING_PRICES: Record<string, number> = {
  '30min': 50,
  '60min': 85,
};

const DEFAULT_DEPOSIT = 25;
const IN_PERSON_MIXING_STUDIO_HOURS = 2;
const IN_PERSON_MIXING_HOURLY_RATE = 80;

interface BookingPricingInput {
  category: string;
  hours?: number;
  mixingTier?: string;
  mixingDelivery?: string;
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
 */
async function calculateBookingPrice(
  input: BookingPricingInput
): Promise<BookingPricingResult | null> {
  const { category, hours, mixingTier, mixingDelivery, consultingDuration, promoId } = input;

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
  category: 'recording' | 'mixing' | 'promo' | 'consulting';
  hours?: number;
  mixingTier?: string;
  mixingDelivery?: string;
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
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        category,
        hours,
        mixingTier,
        mixingDelivery,
        consultingDuration,
        promoId,
        beatId,
        startAt,
        customer,
        sourceId,
      } = req.body as BookingCreateRequest;

      // Validate required fields
      if (!customer?.name || !customer?.email || !customer?.phone) {
        res.status(400).json({ message: 'Customer name, email, and phone are required' });
        return;
      }

      if (!sourceId) {
        res.status(400).json({ message: 'Payment source is required' });
        return;
      }

      // Price is always computed server-side from the booking inputs -
      // never trust a client-submitted amount for what gets charged.
      const pricing = await calculateBookingPrice({
        category,
        hours,
        mixingTier,
        mixingDelivery,
        consultingDuration,
        promoId,
      });

      if (!pricing) {
        res.status(400).json({ message: 'Invalid booking selection - could not determine price' });
        return;
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
          mixingTier: mixingTier || null,
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

      // Handle Square API errors
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

      res.status(500).json({
        success: false,
        message: 'Failed to create booking',
        error: (error as Error).message,
      });
    }
  }
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
            ${(booking.category === 'MIXING' && booking.mixingDelivery === 'remote') ? `
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
  }
}

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
  async (req: Request, res: Response): Promise<void> => {
    try {
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
    } catch (error) {
      console.error('[BOOKINGS] Error fetching bookings:', error);
      res.status(500).json({
        message: 'Failed to fetch bookings',
        error: (error as Error).message,
      });
    }
  }
);

/**
 * GET /api/bookings/:id
 * Get single booking by ID
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          customer: true,
          promo: true,
        },
      });

      if (!booking) {
        res.status(404).json({ message: 'Booking not found' });
        return;
      }

      res.json(booking);
    } catch (error) {
      res.status(500).json({
        message: 'Server error',
        error: (error as Error).message,
      });
    }
  }
);

/**
 * PUT /api/bookings/:id/status
 * Update booking status (admin)
 */
router.put(
  '/:id/status',
  authenticateToken,
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ message: 'Invalid status' });
        return;
      }

      const booking = await prisma.booking.update({
        where: { id },
        data: {
          status,
          notes: notes || undefined,
        },
      });

      res.json(booking);
    } catch (error) {
      res.status(500).json({
        message: 'Failed to update booking',
        error: (error as Error).message,
      });
    }
  }
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
  async (req: Request<{ bookingNumber: string }>, res: Response): Promise<void> => {
    try {
      const { bookingNumber } = req.params;
      const key = typeof req.query.key === 'string' ? req.query.key : undefined;

      if (!key) {
        res.status(400).json({ message: 'Missing reschedule key' });
        return;
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
        res.status(404).json({ message: 'Booking not found' });
        return;
      }

      // Can't reschedule completed or cancelled bookings
      if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
        res.status(400).json({
          message: `Cannot reschedule a ${booking.status.toLowerCase()} booking`
        });
        return;
      }

      // Check 24-hour rule
      if (booking.scheduledAt) {
        const hoursUntilSession = (booking.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilSession < 24) {
          res.status(400).json({
            message: 'Cannot reschedule within 24 hours of your session',
            hoursRemaining: Math.max(0, hoursUntilSession).toFixed(1)
          });
          return;
        }
      }

      const { rescheduleToken: _rescheduleToken, ...bookingResponse } = booking;
      res.json(bookingResponse);
    } catch (error) {
      res.status(500).json({
        message: 'Server error',
        error: (error as Error).message,
      });
    }
  }
);

/**
 * PUT /api/bookings/reschedule/:bookingNumber
 * Reschedule a booking to a new time
 */
router.put(
  '/reschedule/:bookingNumber',
  async (req: Request<{ bookingNumber: string }>, res: Response): Promise<void> => {
    try {
      const { bookingNumber } = req.params;
      const { newDateTime, email } = req.body;
      const key = typeof req.query.key === 'string' ? req.query.key : undefined;

      if (!newDateTime) {
        res.status(400).json({ message: 'New date/time is required' });
        return;
      }

      if (!key) {
        res.status(400).json({ message: 'Missing reschedule key' });
        return;
      }

      const booking = await prisma.booking.findUnique({
        where: { bookingNumber },
      });

      if (!booking || !isValidToken(key, booking.rescheduleToken)) {
        res.status(404).json({ message: 'Booking not found' });
        return;
      }

      // Verify email matches (simple security)
      if (email && booking.email.toLowerCase() !== email.toLowerCase()) {
        res.status(403).json({ message: 'Email does not match booking' });
        return;
      }

      // Can't reschedule completed or cancelled bookings
      if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
        res.status(400).json({
          message: `Cannot reschedule a ${booking.status.toLowerCase()} booking`
        });
        return;
      }

      // Check 24-hour rule for current booking
      if (booking.scheduledAt) {
        const hoursUntilSession = (booking.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilSession < 24) {
          res.status(400).json({
            message: 'Cannot reschedule within 24 hours of your session'
          });
          return;
        }
      }

      // Verify new time is in the future
      const newTime = new Date(newDateTime);
      if (newTime.getTime() <= Date.now()) {
        res.status(400).json({ message: 'New time must be in the future' });
        return;
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
        res.status(400).json({ message: 'This time slot is no longer available' });
        return;
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
    } catch (error) {
      console.error('[BOOKINGS] Error rescheduling:', error);
      res.status(500).json({
        message: 'Failed to reschedule booking',
        error: (error as Error).message,
      });
    }
  }
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
              <td style="padding: 8px 0;"><a href="mailto:${booking.email}" style="color: #E83628;">${booking.email}</a></td>
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
  }
}

export default router;
