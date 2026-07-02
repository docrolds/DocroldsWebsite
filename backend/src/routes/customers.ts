/**
 * Customer Routes
 * Handles all customer-related API endpoints including:
 * - Customer registration and login
 * - Customer profile management
 * - Customer orders and downloads
 * - Customer notifications
 * - Customer likes and playlists
 * - Admin customer management
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import sharp from 'sharp';
import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../config/env';
import {
  authenticateToken,
  requireAdmin,
  authenticateCustomer,
} from '../middleware';
import type {
  AuthenticatedCustomerRequest,
  AuthenticatedAdminRequest,
  CustomerRegisterRequest,
  CustomerLoginRequest,
  CustomerLoginResponse,
  CustomerProfileUpdateRequest,
  PasswordChangeRequest,
  BlockCustomerRequest,
  ImpersonateCustomerResponse,
  ErrorResponse,
} from '../types';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Parse query string parameter that may be string or string[]
 */
function parseQueryString(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) {
    return param[0];
  }
  return param;
}

/**
 * Email validation helper
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Process image to base64 with optimization
 */
async function processPhotoToBase64(
  buffer: Buffer,
  maxWidth: number = 500,
  maxHeight: number = 500,
  quality: number = 80
): Promise<string> {
  const processedBuffer = await sharp(buffer)
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality })
    .toBuffer();

  return `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;
}

/**
 * Create a notification for a customer
 */
async function createNotification(
  customerId: string,
  type: string,
  title: string,
  message: string,
  data: Record<string, unknown> | null = null
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        customerId,
        type,
        title,
        message,
        data: data as Prisma.InputJsonValue,
      },
    });
    console.log(`[NOTIFICATION] Created: ${type} for customer ${customerId}`);
  } catch (error) {
    console.error('[NOTIFICATION] Error creating notification:', (error as Error).message);
  }
}

/**
 * Send welcome email to new customer
 * Note: This is a placeholder - implement actual email sending in production
 */
async function sendWelcomeEmail(customer: { email: string; firstName?: string | null }): Promise<void> {
  const firstName = customer.firstName || 'there';
  console.log(`[EMAIL] Sending welcome email to ${customer.email} (${firstName})`);
  // TODO: Implement actual email sending with SendGrid or nodemailer
}

// ===========================================
// CUSTOMER REGISTRATION & LOGIN
// ===========================================

/**
 * POST /api/customers/register
 * Register a new customer or upgrade a guest to a full account
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, stageName, phone } =
      req.body as CustomerRegisterRequest & { phone?: string };

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' } as ErrorResponse);
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ message: 'Invalid email format' } as ErrorResponse);
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' } as ErrorResponse);
      return;
    }

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { email },
    });

    if (existingCustomer && !existingCustomer.isGuest) {
      res.status(400).json({ message: 'Email already registered' } as ErrorResponse);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let customer;
    if (existingCustomer) {
      // Upgrade guest to full account
      customer = await prisma.customer.update({
        where: { email },
        data: {
          password: hashedPassword,
          firstName,
          lastName,
          stageName,
          phone,
          isGuest: false,
        },
      });

      // Remove download expiry from existing orders
      await prisma.order.updateMany({
        where: { customerId: customer.id },
        data: { downloadExpiresAt: null },
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          stageName,
          phone,
          isGuest: false,
        },
      });
    }

    // Create default playlist
    await prisma.playlist.create({
      data: {
        customerId: customer.id,
        name: 'Saved Beats',
        isDefault: true,
      },
    });

    const token = jwt.sign(
      { id: customer.id, email: customer.email },
      config.auth.jwtCustomerSecret,
      { expiresIn: '7d' }
    );

    // Send welcome email and create notification (non-blocking)
    sendWelcomeEmail(customer).catch((err) =>
      console.error('[REGISTER] Failed to send welcome email:', err.message)
    );

    await createNotification(
      customer.id,
      'WELCOME',
      'Welcome to Doc Rolds!',
      `Welcome, ${customer.firstName || 'there'}! Your account is ready. Explore our beats and start creating.`,
      { actionUrl: '/beats' }
    );

    console.log('[REGISTER] New customer registered:', customer.email);

    res.status(201).json({
      token,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        stageName: customer.stageName,
      },
    } as CustomerLoginResponse);
  } catch (error) {
    console.error('[REGISTER] Error:', error);
    res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
  }
});

/**
 * POST /api/customers/login
 * Authenticate a customer and return a JWT token
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as CustomerLoginRequest;

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' } as ErrorResponse);
      return;
    }

    const customer = await prisma.customer.findUnique({
      where: { email },
    });

    if (!customer || customer.isGuest || !customer.password) {
      res.status(401).json({ message: 'Invalid credentials' } as ErrorResponse);
      return;
    }

    const validPassword = await bcrypt.compare(password, customer.password);

    if (!validPassword) {
      res.status(401).json({ message: 'Invalid credentials' } as ErrorResponse);
      return;
    }

    const token = jwt.sign(
      { id: customer.id, email: customer.email },
      config.auth.jwtCustomerSecret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        stageName: customer.stageName,
        profilePicture: customer.profilePicture,
      },
    } as CustomerLoginResponse);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
  }
});

// ===========================================
// CUSTOMER PROFILE MANAGEMENT
// ===========================================

/**
 * GET /api/customers/me
 * Get the current authenticated customer's profile
 */
router.get('/me', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedCustomerRequest;
    const customer = await prisma.customer.findUnique({
      where: { id: authReq.customer.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        stageName: true,
        username: true,
        phone: true,
        profession: true,
        dateOfBirth: true,
        city: true,
        state: true,
        profilePicture: true,
        createdAt: true,
      },
    });

    if (!customer) {
      res.status(404).json({ message: 'Customer not found' } as ErrorResponse);
      return;
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
  }
});

/**
 * PUT /api/customers/me
 * Update the current authenticated customer's profile
 */
router.put('/me', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedCustomerRequest;
    const {
      firstName,
      lastName,
      stageName,
      username,
      phone,
      profession,
      dateOfBirth,
      city,
      state,
    } = req.body as CustomerProfileUpdateRequest;

    // Check username uniqueness
    if (username) {
      const existing = await prisma.customer.findFirst({
        where: {
          username,
          NOT: { id: authReq.customer.id },
        },
      });
      if (existing) {
        res.status(400).json({ message: 'Username already taken' } as ErrorResponse);
        return;
      }
    }

    const customer = await prisma.customer.update({
      where: { id: authReq.customer.id },
      data: {
        firstName,
        lastName,
        stageName,
        username,
        phone,
        profession,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        city,
        state,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        stageName: true,
        username: true,
        phone: true,
        profession: true,
        dateOfBirth: true,
        city: true,
        state: true,
        profilePicture: true,
      },
    });

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
  }
});

/**
 * POST /api/customers/me/profile-picture
 * Upload a profile picture for the current authenticated customer
 */
router.post(
  '/me/profile-picture',
  authenticateCustomer,
  upload.single('profilePicture'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedCustomerRequest;

      if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' } as ErrorResponse);
        return;
      }

      const photoData = await processPhotoToBase64(req.file.buffer);

      const customer = await prisma.customer.update({
        where: { id: authReq.customer.id },
        data: { profilePicture: photoData },
      });

      res.json({ profilePicture: customer.profilePicture });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
    }
  }
);

/**
 * PUT /api/customers/me/password
 * Change the password for the current authenticated customer
 */
router.put('/me/password', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedCustomerRequest;
    const { currentPassword, newPassword } = req.body as PasswordChangeRequest;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Current and new password required' } as ErrorResponse);
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' } as ErrorResponse);
      return;
    }

    const customer = await prisma.customer.findUnique({
      where: { id: authReq.customer.id },
    });

    if (!customer || !customer.password) {
      res.status(404).json({ message: 'Customer not found' } as ErrorResponse);
      return;
    }

    const validPassword = await bcrypt.compare(currentPassword, customer.password);
    if (!validPassword) {
      res.status(401).json({ message: 'Current password is incorrect' } as ErrorResponse);
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.customer.update({
      where: { id: authReq.customer.id },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
  }
});

// ===========================================
// CUSTOMER ORDERS & DOWNLOADS
// ===========================================

/**
 * GET /api/customers/me/orders
 * Get all orders for the current authenticated customer
 */
router.get('/me/orders', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedCustomerRequest;
    const orders = await prisma.order.findMany({
      where: { customerId: authReq.customer.id },
      include: {
        items: {
          include: {
            beat: {
              select: {
                id: true,
                title: true,
                coverArt: true,
                genre: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
  }
});

/**
 * GET /api/customers/me/downloads
 * Get all downloadable beats for the current authenticated customer
 */
router.get('/me/downloads', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedCustomerRequest;
    const orders = await prisma.order.findMany({
      where: {
        customerId: authReq.customer.id,
        paymentStatus: 'PAID',
      },
      include: {
        items: {
          include: {
            beat: true,
          },
        },
      },
    });

    const downloads = orders.flatMap((order) =>
      order.items.map((item) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        downloadToken: order.downloadToken,
        beatId: item.beatId,
        beat: item.beat,
        license: item.licenseName,
        licenseType: item.licenseType,
        purchasedAt: order.createdAt,
      }))
    );

    res.json(downloads);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
  }
});

// ===========================================
// CUSTOMER LIKES
// ===========================================

/**
 * GET /api/customers/me/likes
 * Get all beats liked by the current authenticated customer
 */
router.get('/me/likes', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedCustomerRequest;
    const likes = await prisma.beatLike.findMany({
      where: { customerId: authReq.customer.id },
      include: {
        beat: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(likes.map((l) => l.beat));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
  }
});

// ===========================================
// CUSTOMER PLAYLISTS
// ===========================================

/**
 * GET /api/customers/me/playlists
 * Get all playlists for the current authenticated customer
 */
router.get('/me/playlists', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedCustomerRequest;
    const playlists = await prisma.playlist.findMany({
      where: { customerId: authReq.customer.id },
      include: {
        beats: {
          include: { beat: true },
          orderBy: { addedAt: 'desc' },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    res.json(playlists);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
  }
});

/**
 * POST /api/customers/me/playlists
 * Create a new playlist for the current authenticated customer
 */
router.post('/me/playlists', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedCustomerRequest;
    const { name } = req.body as { name: string };

    if (!name || name.trim().length === 0) {
      res.status(400).json({ message: 'Playlist name is required' } as ErrorResponse);
      return;
    }

    const playlist = await prisma.playlist.create({
      data: {
        customerId: authReq.customer.id,
        name: name.trim(),
      },
    });

    res.status(201).json(playlist);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
  }
});

// ===========================================
// CUSTOMER NOTIFICATIONS
// ===========================================

/**
 * GET /api/customers/me/notifications
 * Get notifications for the current authenticated customer
 */
router.get('/me/notifications', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedCustomerRequest;
    const { limit = '20', unreadOnly = 'false', offset = '0' } = req.query as {
      limit?: string;
      unreadOnly?: string;
      offset?: string;
    };

    const whereClause: { customerId: string; isRead?: boolean } = {
      customerId: authReq.customer.id,
    };

    if (unreadOnly === 'true') {
      whereClause.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
      skip: parseInt(offset, 10),
    });

    res.json(notifications);
  } catch (error) {
    console.error('[NOTIFICATION] Error fetching notifications:', (error as Error).message);
    res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
  }
});

/**
 * GET /api/customers/me/notifications/unread-count
 * Get the count of unread notifications for the current authenticated customer
 */
router.get(
  '/me/notifications/unread-count',
  authenticateCustomer,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedCustomerRequest;
      const count = await prisma.notification.count({
        where: {
          customerId: authReq.customer.id,
          isRead: false,
        },
      });

      res.json({ count });
    } catch (error) {
      console.error('[NOTIFICATION] Error counting notifications:', (error as Error).message);
      res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
    }
  }
);

/**
 * PUT /api/customers/me/notifications/:id/read
 * Mark a single notification as read
 */
router.put(
  '/me/notifications/:id/read',
  authenticateCustomer,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedCustomerRequest;
      const notificationId = parseQueryString(req.params.id);
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          customerId: authReq.customer.id,
        },
      });

      if (!notification) {
        res.status(404).json({ message: 'Notification not found' } as ErrorResponse);
        return;
      }

      const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      res.json(updated);
    } catch (error) {
      console.error('[NOTIFICATION] Error marking as read:', (error as Error).message);
      res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
    }
  }
);

/**
 * PUT /api/customers/me/notifications/read-all
 * Mark all notifications as read for the current authenticated customer
 */
router.put(
  '/me/notifications/read-all',
  authenticateCustomer,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedCustomerRequest;
      const result = await prisma.notification.updateMany({
        where: {
          customerId: authReq.customer.id,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      res.json({ message: 'All notifications marked as read', count: result.count });
    } catch (error) {
      console.error('[NOTIFICATION] Error marking all as read:', (error as Error).message);
      res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
    }
  }
);

/**
 * DELETE /api/customers/me/notifications/:id
 * Delete a notification
 */
router.delete(
  '/me/notifications/:id',
  authenticateCustomer,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedCustomerRequest;
      const notificationId = parseQueryString(req.params.id);
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          customerId: authReq.customer.id,
        },
      });

      if (!notification) {
        res.status(404).json({ message: 'Notification not found' } as ErrorResponse);
        return;
      }

      await prisma.notification.delete({
        where: { id: notificationId },
      });

      res.json({ message: 'Notification deleted' });
    } catch (error) {
      console.error('[NOTIFICATION] Error deleting notification:', (error as Error).message);
      res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
    }
  }
);

// ===========================================
// ADMIN CUSTOMER MANAGEMENT ROUTES
// ===========================================

/**
 * GET /api/admin/customers
 * Get all customers (admin only)
 */
router.get(
  '/admin/list',
  authenticateToken,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const customers = await prisma.customer.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          stageName: true,
          phone: true,
          isGuest: true,
          isBlocked: true,
          blockedAt: true,
          blockedReason: true,
          createdAt: true,
          _count: {
            select: { orders: true, comments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
    }
  }
);

/**
 * GET /api/admin/customers/:id
 * Get detailed customer information (admin only)
 */
router.get(
  '/admin/:id',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = parseQueryString(req.params.id);
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          orders: {
            include: {
              items: {
                include: { beat: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          likes: {
            include: { beat: true },
            take: 20,
          },
          playlists: {
            include: {
              beats: { include: { beat: true } },
            },
          },
          comments: {
            include: { beat: true },
            take: 20,
          },
        },
      });

      if (!customer) {
        res.status(404).json({ message: 'Customer not found' } as ErrorResponse);
        return;
      }

      // Remove password from response
      const { password, ...customerData } = customer;
      res.json(customerData);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
    }
  }
);

/**
 * PUT /api/admin/customers/:id
 * Update customer information (admin only)
 */
router.put(
  '/admin/:id',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = parseQueryString(req.params.id);
      const { firstName, lastName, stageName, username, phone, profession, city, state, email } =
        req.body as CustomerProfileUpdateRequest & { email?: string };

      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: {
          firstName,
          lastName,
          stageName,
          username,
          phone,
          profession,
          city,
          state,
          email,
        },
      });

      const { password, ...customerData } = customer;
      res.json(customerData);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
    }
  }
);

/**
 * POST /api/admin/customers/:id/reset-password
 * Reset a customer's password (admin only)
 */
router.post(
  '/admin/:id/reset-password',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = parseQueryString(req.params.id);
      const { newPassword } = req.body as { newPassword: string };

      if (!newPassword || newPassword.length < 6) {
        res.status(400).json({ message: 'Password must be at least 6 characters' } as ErrorResponse);
        return;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.customer.update({
        where: { id: customerId },
        data: { password: hashedPassword, isGuest: false },
      });

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
    }
  }
);

/**
 * DELETE /api/admin/customers/:id
 * Delete a customer and all related data (admin only)
 */
router.delete(
  '/admin/:id',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = parseQueryString(req.params.id);

      // Check if customer exists
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          _count: {
            select: { orders: true },
          },
        },
      });

      if (!customer) {
        res.status(404).json({ message: 'Customer not found' } as ErrorResponse);
        return;
      }

      // Use a transaction to delete all related records first
      await prisma.$transaction(async (tx) => {
        // Delete comment likes by this customer
        await tx.commentLike.deleteMany({
          where: { customerId },
        });

        // Delete comments by this customer
        await tx.comment.deleteMany({
          where: { customerId },
        });

        // Delete beat likes
        await tx.beatLike.deleteMany({
          where: { customerId },
        });

        // Delete playlist beats (through playlists)
        await tx.playlistBeat.deleteMany({
          where: {
            playlist: { customerId },
          },
        });

        // Delete playlists
        await tx.playlist.deleteMany({
          where: { customerId },
        });

        // Delete notifications
        await tx.notification.deleteMany({
          where: { customerId },
        });

        // Delete order items first, then orders
        await tx.orderItem.deleteMany({
          where: {
            order: { customerId },
          },
        });

        await tx.order.deleteMany({
          where: { customerId },
        });

        // Finally delete the customer
        await tx.customer.delete({
          where: { id: customerId },
        });
      });

      res.json({ message: 'Customer and all related data deleted successfully' });
    } catch (error) {
      console.error('Error deleting customer:', error);
      res.status(500).json({ message: 'Failed to delete customer', error: (error as Error).message } as ErrorResponse);
    }
  }
);

/**
 * POST /api/admin/customers/:id/block
 * Block a customer (admin only)
 */
router.post(
  '/admin/:id/block',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = parseQueryString(req.params.id);
      const { reason } = req.body as BlockCustomerRequest;

      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: {
          isBlocked: true,
          blockedAt: new Date(),
          blockedReason: reason || 'Blocked by administrator',
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          stageName: true,
          isBlocked: true,
          blockedAt: true,
          blockedReason: true,
        },
      });

      res.json({ message: 'Customer blocked', customer });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
    }
  }
);

/**
 * POST /api/admin/customers/:id/unblock
 * Unblock a customer (admin only)
 */
router.post(
  '/admin/:id/unblock',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = parseQueryString(req.params.id);
      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: {
          isBlocked: false,
          blockedAt: null,
          blockedReason: null,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          stageName: true,
          isBlocked: true,
        },
      });

      res.json({ message: 'Customer unblocked', customer });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
    }
  }
);

/**
 * POST /api/admin/customers/:id/impersonate
 * Generate a customer token for admin to view as customer (admin only)
 */
router.post(
  '/admin/:id/impersonate',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = parseQueryString(req.params.id);
      const authReq = req as AuthenticatedAdminRequest;
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          stageName: true,
          profilePicture: true,
          isGuest: true,
        },
      });

      if (!customer) {
        res.status(404).json({ message: 'Customer not found' } as ErrorResponse);
        return;
      }

      // Generate a customer token for the admin to use
      const customerToken = jwt.sign(
        {
          id: customer.id,
          email: customer.email,
          impersonatedBy: authReq.user.id, // Track who is impersonating
        },
        config.auth.jwtCustomerSecret,
        { expiresIn: '1h' } // Short expiry for security
      );

      console.log(`[ADMIN] User ${authReq.user.username} is impersonating customer ${customer.email}`);

      res.json({
        token: customerToken,
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          stageName: customer.stageName,
          profilePicture: customer.profilePicture,
          isGuest: customer.isGuest,
        },
        message: `You are now viewing as ${customer.email}. Token expires in 1 hour.`,
      } as ImpersonateCustomerResponse & { message: string });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: (error as Error).message } as ErrorResponse);
    }
  }
);

export default router;
