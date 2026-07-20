/**
 * Admin Content Management Routes
 * Handles all admin-related API endpoints including:
 * - Photo management (/api/photos/*)
 * - Content management (/api/content/*)
 * - Team member management (/api/team/*)
 * - Admin metrics/analytics (/api/admin/metrics)
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  authenticateToken,
  requireAdmin,
} from '../middleware';
import { asyncHandler, BadRequestError, NotFoundError, ConflictError } from '../middleware';
import { config } from '../config/env';
import { sendEmail } from '../services/email';
import { captureError } from '../services/sentry';
import { escapeHtml } from '../utils/text';
import { getPresignedDownloadUrl } from '../services/storage';
import { getStripeClient, isStripeConfigured } from '../services/stripe';
import type {
  PhotoUploadRequest,
  TeamMemberRequest,
} from '../types';

const router = Router();
const prisma = new PrismaClient();

/**
 * Parse query string parameter handling array values
 * Express query params can be string | string[] | ParsedQs | ParsedQs[] | undefined
 */
function parseQueryString(param: unknown): string | undefined {
  if (param === undefined || param === null) {
    return undefined;
  }
  if (typeof param === 'string') {
    return param;
  }
  if (Array.isArray(param) && param.length > 0) {
    const first = param[0];
    return typeof first === 'string' ? first : undefined;
  }
  return undefined;
}

// ===========================================
// MULTER CONFIGURATION
// ===========================================

/**
 * Configure multer for file uploads (memory storage)
 * Used for photo uploads that get converted to base64
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
    }
  },
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Process image buffer to base64 with optimization
 * Uses sharp for resizing and format conversion
 */
async function processPhotoToBase64(
  buffer: Buffer,
  width: number = 500,
  height: number = 500,
  quality: number = 80
): Promise<string> {
  try {
    const processedBuffer = await sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality })
      .toBuffer();

    return `data:image/webp;base64,${processedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('[PHOTO] Error processing photo:', error);
    throw error;
  }
}

/**
 * Process team photo to base64 with specific dimensions
 */
async function processTeamPhotoToBase64(buffer: Buffer): Promise<string> {
  return processPhotoToBase64(buffer, 500, 500, 80);
}

// ===========================================
// TEAM MEMBER ROUTES
// ===========================================

/**
 * GET /api/team
 * Get all team members (public endpoint)
 * Returns team members from Photo model where category='team' and displayOnHome=true
 */
router.get(
  '/team',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    // Fetch team members from Photo model (where admin uploads them)
    // Filter by category='team' and displayOnHome=true for public display
    const teamMembers = await prisma.photo.findMany({
      where: {
        category: 'team',
        displayOnHome: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Map to consistent format for frontend
    const formattedTeam = teamMembers.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      bio: member.description,
      credits: member.credits,
      placements: member.placements,
      photoData: member.photoData,
      photoUrl: member.photoFile,
      displayOnHome: member.displayOnHome,
      createdAt: member.createdAt,
    }));

    res.json(formattedTeam);
  })
);

/**
 * POST /api/team
 * Create a new team member (admin only)
 */
router.post(
  '/team',
  authenticateToken,
  requireAdmin,
  upload.single('photo'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, role, bio } = req.body as TeamMemberRequest;
    const photoUrl = req.file ? `/uploads/team/${req.file.filename}` : '';

    const newTeamMember = await prisma.teamMember.create({
      data: {
        name,
        role,
        bio,
        photoUrl,
      },
    });

    res.status(201).json(newTeamMember);
  })
);

/**
 * PUT /api/team/:id
 * Update a team member (admin only)
 */
router.put(
  '/team/:id',
  authenticateToken,
  requireAdmin,
  upload.single('photo'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, role, bio } = req.body as TeamMemberRequest;
    let photoUrl = req.body.photoUrl as string | undefined;

    if (req.file) {
      photoUrl = `/uploads/team/${req.file.filename}`;
    }

    const updatedTeamMember = await prisma.teamMember.update({
      where: { id: req.params.id as string },
      data: {
        name,
        role,
        bio,
        photoUrl,
      },
    });

    res.json(updatedTeamMember);
  })
);

/**
 * DELETE /api/team/:id
 * Delete a team member (admin only)
 */
router.delete(
  '/team/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await prisma.teamMember.delete({
      where: { id: req.params.id as string },
    });
    res.json({ message: 'Team member deleted successfully' });
  })
);

// ===========================================
// CONTENT MANAGEMENT ROUTES
// ===========================================

/**
 * GET /api/content
 * Get all content items (public endpoint)
 * Returns content as key-value map
 */
router.get(
  '/content',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const content = await prisma.content.findMany();
    const contentMap = content.reduce(
      (acc: Record<string, unknown>, item) => {
        acc[item.key] = item.value;
        return acc;
      },
      {}
    );
    res.json(contentMap);
  })
);

/**
 * PUT /api/content/:key
 * Update a content item by key (admin only)
 */
router.put(
  '/content/:key',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const key = req.params.key as string;
    const { value } = req.body as { value: Record<string, unknown> };

    const updatedContent = await prisma.content.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue },
      create: { key, value: value as Prisma.InputJsonValue },
    });

    res.json(updatedContent.value);
  })
);

// ===========================================
// PHOTO MANAGEMENT ROUTES
// ===========================================

/**
 * GET /api/photos
 * Get all photos (public endpoint)
 */
router.get(
  '/photos',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const category = parseQueryString(req.query.category);
    const photos = await prisma.photo.findMany({
      where: category ? { category } : undefined,
    });
    res.json(photos);
  })
);

/**
 * POST /api/photos
 * Upload a new photo (admin only)
 * Supports file upload with metadata
 */
router.post(
  '/photos',
  authenticateToken,
  requireAdmin,
  upload.single('photoFile'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      name,
      role,
      credits,
      placements,
      category,
      description,
      displayOnHome,
    } = req.body as PhotoUploadRequest;

    if (!category) {
      throw new BadRequestError('Category is required');
    }

    let photoData: string | null = null;
    let mimeType: string | null = null;

    if (req.file) {
      mimeType = req.file.mimetype;
      photoData = await processTeamPhotoToBase64(req.file.buffer);
    }

    const newPhoto = await prisma.photo.create({
      data: {
        name: name || 'Untitled Photo',
        role: role || '',
        credits: credits || '',
        placements: placements || '',
        category,
        description: description || '',
        photoData,
        mimeType,
        displayOnHome: displayOnHome === true || String(displayOnHome) === 'true',
      },
    });

    res.status(201).json(newPhoto);
  })
);

/**
 * PUT /api/photos/:id
 * Update a photo (admin only)
 */
router.put(
  '/photos/:id',
  authenticateToken,
  requireAdmin,
  upload.single('photoFile'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      name,
      role,
      credits,
      placements,
      category,
      description,
      displayOnHome,
    } = req.body as PhotoUploadRequest;

    const photo = await prisma.photo.findUnique({
      where: { id: req.params.id as string },
    });

    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    // Build update data object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (credits !== undefined) updateData.credits = credits;
    if (placements !== undefined) updateData.placements = placements;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (displayOnHome !== undefined) {
      updateData.displayOnHome = displayOnHome === true || String(displayOnHome) === 'true';
    }

    if (req.file) {
      updateData.photoData = await processTeamPhotoToBase64(req.file.buffer);
      updateData.mimeType = req.file.mimetype;
    }

    const updatedPhoto = await prisma.photo.update({
      where: { id: req.params.id as string },
      data: updateData,
    });

    res.json(updatedPhoto);
  })
);

/**
 * DELETE /api/photos/:id
 * Delete a photo (admin only)
 */
router.delete(
  '/photos/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await prisma.photo.delete({
      where: { id: req.params.id as string },
    });
    res.json({ message: 'Photo deleted successfully' });
  })
);

// ===========================================
// ADMIN METRICS ROUTES
// ===========================================

/**
 * GET /api/admin/metrics/orders
 * Get order metrics for admin dashboard (admin only)
 * Supports period parameter: 7d, 30d, 90d
 */
router.get(
  '/admin/metrics/orders',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const period = parseQueryString(req.query.period) || '30d';

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get orders within period
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
    });

    // Calculate metrics
    const totalOrders = orders.length;
    const completedOrders = orders.filter((o) => o.status === 'COMPLETED').length;
    const pendingOrders = orders.filter((o) => o.status === 'PENDING').length;
    const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED').length;

    const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

    // Orders by status
    const ordersByStatus = {
      COMPLETED: completedOrders,
      PENDING: pendingOrders,
      CANCELLED: cancelledOrders,
      REFUNDED: orders.filter((o) => o.status === 'REFUNDED').length,
    };

    // Orders by payment status
    const ordersByPaymentStatus = {
      PAID: paidOrders.length,
      PENDING: orders.filter((o) => o.paymentStatus === 'PENDING').length,
      FAILED: orders.filter((o) => o.paymentStatus === 'FAILED').length,
      REFUNDED: orders.filter((o) => o.paymentStatus === 'REFUNDED').length,
    };

    // Orders over time (group by day)
    const ordersByDay: Record<string, { count: number; revenue: number }> = {};
    orders.forEach((order) => {
      const day = order.createdAt.toISOString().split('T')[0];
      if (!ordersByDay[day]) {
        ordersByDay[day] = { count: 0, revenue: 0 };
      }
      ordersByDay[day].count++;
      if (order.paymentStatus === 'PAID') {
        ordersByDay[day].revenue += order.total;
      }
    });

    // Convert to array sorted by date
    const revenueByDay = Object.entries(ordersByDay)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get previous period for comparison
    const prevStartDate = new Date(
      startDate.getTime() - (now.getTime() - startDate.getTime())
    );
    const prevOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: prevStartDate,
          lt: startDate,
        },
        paymentStatus: 'PAID',
      },
      select: { total: true },
    });

    const prevRevenue = prevOrders.reduce((sum, o) => sum + o.total, 0);
    const revenueChange =
      prevRevenue > 0
        ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
        : totalRevenue > 0
          ? 100
          : 0;

    res.json({
      period,
      totalOrders,
      completedOrders,
      pendingOrders,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      averageOrderValue: parseFloat(avgOrderValue.toFixed(2)),
      ordersByStatus,
      ordersByPaymentStatus,
      ordersOverTime: revenueByDay,
      comparison: {
        prevRevenue: parseFloat(prevRevenue.toFixed(2)),
        revenueChange: parseFloat(revenueChange.toFixed(1)),
      },
    });
  })
);

// ===========================================
// ADMIN BOOKINGS ENDPOINTS
// ===========================================

/**
 * GET /api/admin/bookings
 * Get all bookings for admin dashboard
 */
router.get(
  '/admin/bookings',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const status = parseQueryString(req.query.status);
    const startDate = parseQueryString(req.query.startDate);
    const endDate = parseQueryString(req.query.endDate);

    interface BookingWhereClause {
      status?: string;
      scheduledAt?: {
        gte?: Date;
        lte?: Date;
      };
    }

    const where: BookingWhereClause = {};

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) {
        where.scheduledAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.scheduledAt.lte = new Date(endDate);
      }
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        customer: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            stageName: true,
          },
        },
        promo: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });

    res.json(bookings);
  })
);

/**
 * GET /api/admin/bookings/:id
 * Get single booking details
 */
router.get(
  '/admin/bookings/:id',
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

interface UpdateBookingStatusRequest {
  status?: string;
  notes?: string;
  scheduledAt?: string;
}

/**
 * PATCH /api/admin/bookings/:id
 * Update booking status or details
 */
router.patch(
  '/admin/bookings/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { status, notes, scheduledAt } = req.body as UpdateBookingStatusRequest;

    const updateData: Prisma.BookingUpdateInput = {};

    if (status) {
      const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
      if (!validStatuses.includes(status)) {
        throw new BadRequestError('Invalid status');
      }
      updateData.status = status;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (scheduledAt) {
      updateData.scheduledAt = new Date(scheduledAt);
    }

    const previousBooking = await prisma.booking.findUnique({ where: { id } });
    if (!previousBooking) {
      throw new NotFoundError('Booking not found');
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
      },
    });

    console.log(`[ADMIN] Booking ${booking.bookingNumber} updated - Status: ${booking.status}`);

    // Only notify on a genuine transition into CANCELLED - the refund
    // route has its own combined refund+cancellation email and sets
    // CANCELLED directly via a separate code path, so there's no overlap.
    if (status === 'CANCELLED' && previousBooking.status !== 'CANCELLED') {
      try {
        await sendEmail({
          to: booking.email,
          subject: `Booking Cancelled - #${booking.bookingNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 30px;">
              <h1 style="color: #E83628; text-align: center;">Booking Cancelled</h1>
              <p>Hey ${escapeHtml(booking.name)},</p>
              <p>Your booking <strong>#${booking.bookingNumber}</strong> has been cancelled.</p>
              <p>If you have any questions or want to book a new session, reach out anytime.</p>
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
        console.error('[ADMIN] Failed to send booking cancellation email:', (emailError as Error).message);
        captureError(emailError, { bookingNumber: booking.bookingNumber, context: 'booking-cancellation-email' });
      }
    }

    res.json(booking);
  })
);

/**
 * DELETE /api/admin/bookings/:id
 * Delete/cancel a booking
 */
router.delete(
  '/admin/bookings/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;

    // Soft delete by setting status to CANCELLED
    const booking = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    console.log(`[ADMIN] Booking ${booking.bookingNumber} cancelled`);

    res.json({ message: 'Booking cancelled', booking });
  })
);

// ===========================================
// PROMO MANAGEMENT (admin)
// ===========================================
// Public listing of active promos lives at GET /api/bookings/promos
// (bookings.ts) - these routes are the admin CRUD surface.

interface PromoRequestBody {
  name: string;
  description?: string | null;
  price: number;
  originalValue: number;
  includesSession?: boolean;
  sessionHours?: number | null;
  includesBeat?: boolean;
  beatLicenseType?: string | null;
  includesMixing?: boolean;
  mixingTier?: string | null;
  active?: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
}

interface PromoPatchBody extends Partial<PromoRequestBody> {}

function shapePromo(promo: {
  id: string;
  name: string;
  description: string | null;
  price: number;
  originalValue: number;
  includesSession: boolean;
  sessionHours: number | null;
  includesBeat: boolean;
  beatLicenseType: string | null;
  includesMixing: boolean;
  mixingTier: string | null;
  active: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  createdAt: Date;
  _count?: { bookings: number };
}) {
  const savings = promo.originalValue - promo.price;
  return {
    ...promo,
    bookingsCount: promo._count?.bookings ?? 0,
    savings,
    savingsPercent: promo.originalValue > 0 ? Math.round((savings / promo.originalValue) * 100) : 0,
  };
}

/**
 * GET /api/admin/promos
 * List all promos, including inactive ones (unlike the public listing).
 */
router.get(
  '/admin/promos',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const promos = await prisma.promo.findMany({
      include: { _count: { select: { bookings: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(promos.map(shapePromo));
  })
);

/**
 * POST /api/admin/promos
 * Create a new promo.
 */
router.post(
  '/admin/promos',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = req.body as PromoRequestBody;

    if (!body.name || body.price === undefined || body.originalValue === undefined) {
      throw new BadRequestError('name, price, and originalValue are required');
    }

    const promo = await prisma.promo.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        price: body.price,
        originalValue: body.originalValue,
        includesSession: body.includesSession ?? true,
        sessionHours: body.sessionHours ?? null,
        includesBeat: body.includesBeat ?? false,
        beatLicenseType: body.beatLicenseType ?? null,
        includesMixing: body.includesMixing ?? false,
        mixingTier: body.mixingTier ?? null,
        active: body.active ?? true,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
      },
      include: { _count: { select: { bookings: true } } },
    });

    res.status(201).json(shapePromo(promo));
  })
);

/**
 * PATCH /api/admin/promos/:id
 * Update a promo (partial - e.g. just toggling `active`).
 */
router.patch(
  '/admin/promos/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const body = req.body as PromoPatchBody;

    const existing = await prisma.promo.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Promo not found');
    }

    const data: Prisma.PromoUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.price !== undefined) data.price = body.price;
    if (body.originalValue !== undefined) data.originalValue = body.originalValue;
    if (body.includesSession !== undefined) data.includesSession = body.includesSession;
    if (body.sessionHours !== undefined) data.sessionHours = body.sessionHours;
    if (body.includesBeat !== undefined) data.includesBeat = body.includesBeat;
    if (body.beatLicenseType !== undefined) data.beatLicenseType = body.beatLicenseType;
    if (body.includesMixing !== undefined) data.includesMixing = body.includesMixing;
    if (body.mixingTier !== undefined) data.mixingTier = body.mixingTier;
    if (body.active !== undefined) data.active = body.active;
    if (body.validFrom !== undefined) data.validFrom = body.validFrom ? new Date(body.validFrom) : null;
    if (body.validUntil !== undefined) data.validUntil = body.validUntil ? new Date(body.validUntil) : null;

    const promo = await prisma.promo.update({
      where: { id },
      data,
      include: { _count: { select: { bookings: true } } },
    });

    res.json(shapePromo(promo));
  })
);

/**
 * DELETE /api/admin/promos/:id
 */
router.delete(
  '/admin/promos/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;

    const existing = await prisma.promo.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Promo not found');
    }

    await prisma.promo.delete({ where: { id } });
    res.json({ success: true });
  })
);

// ===========================================
// COLLABORATOR PAYOUTS (Stripe Connect)
// ===========================================

interface CreateCollaboratorRequest {
  name?: string;
  email?: string;
  isBusinessAccount?: boolean;
}

interface SetBeatCollaboratorsRequest {
  collaborators?: Array<{ collaboratorId: string; splitPercentage: number }>;
}

/**
 * Generates a fresh Stripe Connect onboarding link for a collaborator and
 * emails it to them. Shared by both the initial invite and the
 * resend-onboarding route.
 */
async function sendCollaboratorOnboardingEmail(collaborator: { name: string; email: string; stripeAccountId: string | null }): Promise<void> {
  if (!collaborator.stripeAccountId) return;
  const stripe = getStripeClient();
  const accountLink = await stripe.accountLinks.create({
    account: collaborator.stripeAccountId,
    refresh_url: `${config.frontendUrl}/`,
    return_url: `${config.frontendUrl}/`,
    type: 'account_onboarding',
  });

  await sendEmail({
    to: collaborator.email,
    subject: `You've been added as a Doc Rolds collaborator`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 30px;">
        <h1 style="color: #E83628; text-align: center;">Set Up Your Payout Account</h1>
        <p>Hey ${escapeHtml(collaborator.name)},</p>
        <p>You've been added as a collaborator on Doc Rolds. To receive your share of future beat sales automatically, complete your Stripe payout setup:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${accountLink.url}" style="display: inline-block; background: #E83628; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            Complete Payout Setup
          </a>
        </div>
        <p style="color: #999; font-size: 12px;">This link expires shortly - if it stops working, ask us to resend it.</p>
      </div>
    `,
  });
}

/**
 * GET /api/admin/collaborators
 * List all collaborators (admin only).
 */
router.get(
  '/admin/collaborators',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const collaborators = await prisma.collaborator.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(collaborators);
  })
);

/**
 * POST /api/admin/collaborators
 * Create a collaborator, create their Stripe Connect Express account, and
 * email them an onboarding link (admin only).
 */
router.post(
  '/admin/collaborators',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, email, isBusinessAccount } = req.body as CreateCollaboratorRequest;
    if (!name?.trim() || !email?.trim()) {
      throw new BadRequestError('Name and email are required');
    }

    const existing = await prisma.collaborator.findUnique({ where: { email: email.trim() } });
    if (existing) {
      throw new ConflictError('A collaborator with this email already exists');
    }

    // The business's own row never gets a Stripe Connect account - no
    // transfer is ever created for it, its share simply stays in the
    // platform balance (see orders.ts's payout logic), so there's nothing
    // to onboard.
    if (isBusinessAccount) {
      const existingBusiness = await prisma.collaborator.findFirst({ where: { isBusinessAccount: true } });
      if (existingBusiness) {
        throw new ConflictError('A business-account collaborator already exists');
      }
      const collaborator = await prisma.collaborator.create({
        data: {
          name: name.trim(),
          email: email.trim(),
          isBusinessAccount: true,
          onboardingStatus: 'COMPLETE',
        },
      });
      res.status(201).json(collaborator);
      return;
    }

    if (!isStripeConfigured()) {
      throw new BadRequestError('Stripe is not configured - cannot create collaborator payout accounts');
    }

    const stripe = getStripeClient();
    const account = await stripe.accounts.create({
      type: 'express',
      email: email.trim(),
      capabilities: { transfers: { requested: true } },
    });

    const collaborator = await prisma.collaborator.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        stripeAccountId: account.id,
        onboardingStatus: 'PENDING',
      },
    });

    sendCollaboratorOnboardingEmail(collaborator).catch((err) => {
      console.error('[ADMIN] Failed to send collaborator onboarding email:', err);
      captureError(err, { context: 'sendCollaboratorOnboardingEmail', collaboratorId: collaborator.id });
    });

    res.status(201).json(collaborator);
  })
);

/**
 * POST /api/admin/collaborators/:id/resend-onboarding
 * Regenerates and re-sends the Stripe Connect onboarding link (admin only).
 */
router.post(
  '/admin/collaborators/:id/resend-onboarding',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!isStripeConfigured()) {
      throw new BadRequestError('Stripe is not configured');
    }

    const id = req.params.id as string;
    const collaborator = await prisma.collaborator.findUnique({ where: { id } });
    if (!collaborator) {
      throw new NotFoundError('Collaborator not found');
    }
    if (!collaborator.stripeAccountId) {
      throw new BadRequestError('Collaborator has no Stripe account to onboard');
    }

    await sendCollaboratorOnboardingEmail(collaborator);
    res.json({ message: 'Onboarding link resent' });
  })
);

/**
 * PUT /api/admin/beats/:id/collaborators
 * Replaces a beat's collaborator/split set. Splits must sum to exactly
 * 100 across all rows (admin only). Transactional so a partial write can
 * never leave the beat's splits summing to something other than 100.
 */
router.put(
  '/admin/beats/:id/collaborators',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const beatId = req.params.id as string;
    const { collaborators } = req.body as SetBeatCollaboratorsRequest;

    if (!Array.isArray(collaborators) || collaborators.length === 0) {
      throw new BadRequestError('At least one collaborator split is required');
    }

    const total = collaborators.reduce((sum, c) => sum + (Number(c.splitPercentage) || 0), 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new BadRequestError(`Collaborator splits must sum to 100 (got ${total})`);
    }

    const beat = await prisma.beat.findUnique({ where: { id: beatId } });
    if (!beat) {
      throw new NotFoundError('Beat not found');
    }

    await prisma.$transaction([
      prisma.beatCollaborator.deleteMany({ where: { beatId } }),
      prisma.beatCollaborator.createMany({
        data: collaborators.map((c) => ({
          beatId,
          collaboratorId: c.collaboratorId,
          splitPercentage: Number(c.splitPercentage),
        })),
      }),
    ]);

    const updated = await prisma.beatCollaborator.findMany({
      where: { beatId },
      include: { collaborator: true },
    });
    res.json(updated);
  })
);

/**
 * GET /api/admin/beats/:id/collaborators
 * Returns the current collaborator/split set for a beat (admin only).
 */
router.get(
  '/admin/beats/:id/collaborators',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const beatId = req.params.id as string;
    const collaborators = await prisma.beatCollaborator.findMany({
      where: { beatId },
      include: { collaborator: true },
    });
    res.json(collaborators);
  })
);

/**
 * GET /api/admin/orders/:id/transfers
 * Lists collaborator payout transfers for an order's items (admin only) -
 * surfaces FAILED transfers (e.g. collaborator not yet onboarded when the
 * sale happened) so admin has a visible retry action.
 */
router.get(
  '/admin/orders/:id/transfers',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const orderId = req.params.id as string;
    const transfers = await prisma.orderItemTransfer.findMany({
      where: { orderItem: { orderId } },
      include: { collaborator: true, orderItem: { include: { beat: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(transfers);
  })
);

/**
 * POST /api/admin/transfers/:id/retry
 * Re-attempts a FAILED collaborator transfer (e.g. after the collaborator
 * has since completed Stripe onboarding). No-op if already COMPLETED.
 */
router.post(
  '/admin/transfers/:id/retry',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!isStripeConfigured()) {
      throw new BadRequestError('Stripe is not configured');
    }

    const id = req.params.id as string;
    const transfer = await prisma.orderItemTransfer.findUnique({
      where: { id },
      include: { collaborator: true, orderItem: { include: { order: true } } },
    });
    if (!transfer) {
      throw new NotFoundError('Transfer not found');
    }
    if (transfer.status === 'COMPLETED') {
      res.json(transfer);
      return;
    }
    if (!transfer.collaborator.stripeAccountId || transfer.collaborator.onboardingStatus !== 'COMPLETE') {
      throw new BadRequestError('Collaborator has not completed Stripe onboarding yet');
    }
    if (!transfer.orderItem.order.squarePaymentId) {
      throw new BadRequestError('Order has no payment reference to retry against');
    }

    const stripe = getStripeClient();
    const intent = await stripe.paymentIntents.retrieve(transfer.orderItem.order.squarePaymentId);
    const sourceCharge = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
    if (!sourceCharge) {
      throw new BadRequestError('Original payment charge could not be found');
    }

    const stripeTransfer = await stripe.transfers.create({
      amount: Math.round(transfer.amount * 100),
      currency: 'usd',
      destination: transfer.collaborator.stripeAccountId,
      source_transaction: sourceCharge,
    });

    const updated = await prisma.orderItemTransfer.update({
      where: { id },
      data: { status: 'COMPLETED', stripeTransferId: stripeTransfer.id },
    });

    res.json(updated);
  })
);

// ===========================================
// STEM SUBMISSIONS (Mixing/Mastering bookings)
// ===========================================

/**
 * GET /api/admin/bookings/:id/stems
 * List stem submissions for a booking with short-lived presigned R2
 * download URLs per file (admin only; bucket is private).
 */
router.get(
  '/admin/bookings/:id/stems',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params.id as string;
    const submissions = await prisma.stemSubmission.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = await Promise.all(
      submissions.map(async (s) => ({
        id: s.id,
        songName: s.songName,
        artistName: s.artistName,
        notes: s.notes,
        createdAt: s.createdAt,
        files: await Promise.all(
          s.files.map(async (fileKey) => ({
            filename: fileKey.split('/').pop() || fileKey,
            url: await getPresignedDownloadUrl(fileKey),
          }))
        ),
      }))
    );

    res.json(formatted);
  })
);

// ===========================================
// REPORTED COMMENTS MODERATION
// ===========================================

/**
 * GET /api/admin/comments/reported
 * List all comments flagged as reported (admin only)
 */
router.get(
  '/admin/comments/reported',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const reported = await prisma.comment.findMany({
      where: { isReported: true },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, stageName: true, email: true } },
        beat: { select: { id: true, title: true } },
      },
      orderBy: { reportedAt: 'desc' },
    });

    const reporterIds = reported
      .map((c) => c.reportedBy)
      .filter((id): id is string => Boolean(id));
    const reporters = reporterIds.length
      ? await prisma.customer.findMany({
          where: { id: { in: reporterIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const reporterMap = new Map(reporters.map((r) => [r.id, r]));

    const formatted = reported.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      reportedAt: c.reportedAt,
      author: c.customer,
      beat: c.beat,
      reportedBy: c.reportedBy ? reporterMap.get(c.reportedBy) ?? null : null,
    }));

    res.json(formatted);
  })
);

/**
 * POST /api/admin/comments/:id/dismiss
 * Clear the report flag on a comment without deleting it (admin only)
 */
router.post(
  '/admin/comments/:id/dismiss',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    await prisma.comment.update({
      where: { id },
      data: { isReported: false, reportedAt: null, reportedBy: null },
    });

    res.json({ message: 'Report dismissed' });
  })
);

/**
 * DELETE /api/admin/comments/:id
 * Permanently delete a comment (admin only; cascades to replies/likes)
 */
router.delete(
  '/admin/comments/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    await prisma.comment.delete({ where: { id } });
    res.json({ message: 'Comment deleted' });
  })
);

export default router;
