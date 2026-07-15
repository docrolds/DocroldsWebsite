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
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware';
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
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const photos = await prisma.photo.findMany();
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
      avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
      ordersByStatus,
      ordersByPaymentStatus,
      revenueByDay,
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

/**
 * PUT /api/admin/bookings/:id
 * Update booking status or details
 */
router.put(
  '/admin/bookings/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { status, notes, scheduledAt } = req.body;

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

    const booking = await prisma.booking.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
      },
    });

    console.log(`[ADMIN] Booking ${booking.bookingNumber} updated - Status: ${booking.status}`);

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

export default router;
