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
import type {
  PhotoUploadRequest,
  TeamMemberRequest,
  ErrorResponse,
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
router.get('/team', async (_req: Request, res: Response): Promise<void> => {
  try {
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
  } catch (error) {
    res.status(500).json({
      message: 'Server error',
      error: (error as Error).message,
    } as ErrorResponse);
  }
});

/**
 * POST /api/team
 * Create a new team member (admin only)
 */
router.post(
  '/team',
  authenticateToken,
  requireAdmin,
  upload.single('photo'),
  async (req: Request, res: Response): Promise<void> => {
    try {
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
    } catch (error) {
      res.status(500).json({
        message: 'Server error',
        error: (error as Error).message,
      } as ErrorResponse);
    }
  }
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
  async (req: Request, res: Response): Promise<void> => {
    try {
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
    } catch (error) {
      res.status(500).json({
        message: 'Server error',
        error: (error as Error).message,
      } as ErrorResponse);
    }
  }
);

/**
 * DELETE /api/team/:id
 * Delete a team member (admin only)
 */
router.delete(
  '/team/:id',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await prisma.teamMember.delete({
        where: { id: req.params.id as string },
      });
      res.json({ message: 'Team member deleted successfully' });
    } catch (error) {
      res.status(500).json({
        message: 'Server error',
        error: (error as Error).message,
      } as ErrorResponse);
    }
  }
);

// ===========================================
// CONTENT MANAGEMENT ROUTES
// ===========================================

/**
 * GET /api/content
 * Get all content items (public endpoint)
 * Returns content as key-value map
 */
router.get('/content', async (_req: Request, res: Response): Promise<void> => {
  try {
    const content = await prisma.content.findMany();
    const contentMap = content.reduce(
      (acc: Record<string, unknown>, item) => {
        acc[item.key] = item.value;
        return acc;
      },
      {}
    );
    res.json(contentMap);
  } catch (error) {
    res.status(500).json({
      message: 'Server error',
      error: (error as Error).message,
    } as ErrorResponse);
  }
});

/**
 * PUT /api/content/:key
 * Update a content item by key (admin only)
 */
router.put(
  '/content/:key',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const key = req.params.key as string;
      const { value } = req.body as { value: Record<string, unknown> };

      const updatedContent = await prisma.content.upsert({
        where: { key },
        update: { value: value as Prisma.InputJsonValue },
        create: { key, value: value as Prisma.InputJsonValue },
      });

      res.json(updatedContent.value);
    } catch (error) {
      res.status(500).json({
        message: 'Server error',
        error: (error as Error).message,
      } as ErrorResponse);
    }
  }
);

// ===========================================
// PHOTO MANAGEMENT ROUTES
// ===========================================

/**
 * GET /api/photos
 * Get all photos (public endpoint)
 */
router.get('/photos', async (_req: Request, res: Response): Promise<void> => {
  try {
    const photos = await prisma.photo.findMany();
    res.json(photos);
  } catch (error) {
    res.status(500).json({
      message: 'Server error',
      error: (error as Error).message,
    } as ErrorResponse);
  }
});

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
  async (req: Request, res: Response): Promise<void> => {
    try {
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
        res.status(400).json({ message: 'Category is required' } as ErrorResponse);
        return;
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
    } catch (error) {
      console.error('[PHOTO] Upload error:', error);
      res.status(500).json({
        message: 'Server error',
        error: (error as Error).message,
      } as ErrorResponse);
    }
  }
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
  async (req: Request, res: Response): Promise<void> => {
    try {
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
        res.status(404).json({ message: 'Photo not found' } as ErrorResponse);
        return;
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
    } catch (error) {
      console.error('[PHOTO] Update error:', error);
      res.status(500).json({
        message: 'Server error',
        error: (error as Error).message,
      } as ErrorResponse);
    }
  }
);

/**
 * DELETE /api/photos/:id
 * Delete a photo (admin only)
 */
router.delete(
  '/photos/:id',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await prisma.photo.delete({
        where: { id: req.params.id as string },
      });
      res.json({ message: 'Photo deleted successfully' });
    } catch (error) {
      console.error('[PHOTO] Delete error:', error);
      res.status(500).json({
        message: 'Server error',
        error: (error as Error).message,
      } as ErrorResponse);
    }
  }
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
  async (req: Request, res: Response): Promise<void> => {
    try {
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
    } catch (error) {
      console.error('[METRICS] Error fetching order metrics:', (error as Error).message);
      res.status(500).json({
        message: 'Server error',
        error: (error as Error).message,
      } as ErrorResponse);
    }
  }
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
  async (req: Request, res: Response): Promise<void> => {
    try {
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
    } catch (error) {
      console.error('[ADMIN] Error fetching bookings:', (error as Error).message);
      res.status(500).json({
        message: 'Failed to fetch bookings',
        error: (error as Error).message,
      } as ErrorResponse);
    }
  }
);

/**
 * GET /api/admin/bookings/:id
 * Get single booking details
 */
router.get(
  '/admin/bookings/:id',
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
        res.status(404).json({ message: 'Booking not found' } as ErrorResponse);
        return;
      }

      res.json(booking);
    } catch (error) {
      res.status(500).json({
        message: 'Server error',
        error: (error as Error).message,
      } as ErrorResponse);
    }
  }
);

/**
 * PUT /api/admin/bookings/:id
 * Update booking status or details
 */
router.put(
  '/admin/bookings/:id',
  authenticateToken,
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, notes, scheduledAt } = req.body;

      const updateData: Prisma.BookingUpdateInput = {};

      if (status) {
        const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
        if (!validStatuses.includes(status)) {
          res.status(400).json({ message: 'Invalid status' } as ErrorResponse);
          return;
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
    } catch (error) {
      console.error('[ADMIN] Error updating booking:', (error as Error).message);
      res.status(500).json({
        message: 'Failed to update booking',
        error: (error as Error).message,
      } as ErrorResponse);
    }
  }
);

/**
 * DELETE /api/admin/bookings/:id
 * Delete/cancel a booking
 */
router.delete(
  '/admin/bookings/:id',
  authenticateToken,
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Soft delete by setting status to CANCELLED
      const booking = await prisma.booking.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      console.log(`[ADMIN] Booking ${booking.bookingNumber} cancelled`);

      res.json({ message: 'Booking cancelled', booking });
    } catch (error) {
      console.error('[ADMIN] Error cancelling booking:', (error as Error).message);
      res.status(500).json({
        message: 'Failed to cancel booking',
        error: (error as Error).message,
      } as ErrorResponse);
    }
  }
);

export default router;
