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
import * as crypto from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../config/env';
import { sendEmail } from '../services/email';
import { captureError } from '../services/sentry';
import { isValidEmail } from '../utils/text';
import { getLicensePricing } from '../services/pricing';
import {
  authenticateToken,
  requireAdmin,
  authenticateCustomer,
  authLimiter,
} from '../middleware';
import {
  asyncHandler,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
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
 */
async function sendWelcomeEmail(customer: { email: string; firstName?: string | null }): Promise<void> {
  const firstName = customer.firstName || 'there';
  try {
    await sendEmail({
      to: customer.email,
      subject: 'Welcome to Doc Rolds',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 30px;">
          <h1 style="color: #E83628; text-align: center;">Welcome to Doc Rolds, ${firstName}!</h1>
          <p style="color: #ccc; font-size: 14px; line-height: 1.6;">
            Your account has been created. You can now browse beats, manage your orders, and book studio sessions from your dashboard.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.frontendUrl}" style="background: #E83628; color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
              Visit Doc Rolds
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Doc Rolds Music - <a href="${config.frontendUrl}" style="color: #E83628;">docrolds.com</a>
          </p>
        </div>
      `,
    });
    console.log(`[EMAIL] Welcome email sent to ${customer.email}`);
  } catch (error) {
    console.error('[EMAIL] Failed to send welcome email:', (error as Error).message);
    captureError(error, { email: customer.email, context: 'welcome-email' });
  }
}

// ===========================================
// CUSTOMER REGISTRATION & LOGIN
// ===========================================

/**
 * POST /api/customers/register
 * Register a new customer or upgrade a guest to a full account
 */
router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password, firstName, lastName, stageName, phone } =
      req.body as CustomerRegisterRequest & { phone?: string };

    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    if (!isValidEmail(email)) {
      throw new BadRequestError('Invalid email format');
    }

    if (password.length < 6) {
      throw new BadRequestError('Password must be at least 6 characters');
    }

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { email },
    });

    if (existingCustomer && !existingCustomer.isGuest) {
      throw new BadRequestError('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

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
  })
);

/**
 * POST /api/customers/login
 * Authenticate a customer and return a JWT token
 */
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as CustomerLoginRequest;

    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const customer = await prisma.customer.findUnique({
      where: { email },
    });

    if (!customer || customer.isGuest || !customer.password) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (customer.isBlocked) {
      throw new ForbiddenError(
        customer.blockedReason || 'Your account has been blocked. Please contact support.'
      );
    }

    const validPassword = await bcrypt.compare(password, customer.password);

    if (!validPassword) {
      throw new UnauthorizedError('Invalid credentials');
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
  })
);

// ===========================================
// PASSWORD RESET (self-service)
// ===========================================

interface ForgotPasswordRequest {
  email: string;
}

/**
 * POST /api/customers/forgot-password
 * Starts a self-service password reset. Always returns the same generic
 * message regardless of whether the email matched an account, to avoid
 * leaking which emails are registered.
 */
router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as ForgotPasswordRequest;
    const genericMessage = 'If an account exists for that email, a reset link has been sent.';

    if (!email || !isValidEmail(email)) {
      // Still return the generic message - don't reveal validation details
      // that could help enumerate accounts.
      res.json({ message: genericMessage });
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { email } });

    if (customer && !customer.isGuest && customer.password) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.customer.update({
        where: { id: customer.id },
        data: { passwordResetToken: token, passwordResetExpiresAt: expiresAt },
      });

      const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

      // Fire-and-forget: don't let email-provider latency create a timing
      // difference between the "registered" and "unregistered" response
      // paths (both should respond equally fast).
      sendEmail({
        to: customer.email,
        subject: 'Reset Your Doc Rolds Password',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 30px;">
              <h1 style="color: #E83628; text-align: center;">Reset Your Password</h1>
              <p style="color: #ccc; font-size: 14px; line-height: 1.6;">
                We received a request to reset your Doc Rolds password. Click the button below to choose a new one - this link expires in 1 hour.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: #E83628; color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color: #999; font-size: 12px;">
                If you didn't request this, you can safely ignore this email - your password won't change.
              </p>
              <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">
              <p style="color: #999; font-size: 12px; text-align: center;">
                Doc Rolds Music - <a href="${config.frontendUrl}" style="color: #E83628;">docrolds.com</a>
              </p>
            </div>
          `,
      }).catch((error) => {
        console.error('[EMAIL] Failed to send password reset email:', (error as Error).message);
        captureError(error, { email: customer.email, context: 'password-reset-email' });
      });
    }

    res.json({ message: genericMessage });
  })
);

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/**
 * POST /api/customers/reset-password
 * Completes a self-service password reset given a valid, unexpired token.
 */
router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { token, newPassword } = req.body as ResetPasswordRequest;

    if (!token || !newPassword) {
      throw new BadRequestError('Token and new password are required');
    }

    if (newPassword.length < 6) {
      throw new BadRequestError('Password must be at least 6 characters');
    }

    const customer = await prisma.customer.findUnique({ where: { passwordResetToken: token } });

    if (
      !customer ||
      !customer.passwordResetExpiresAt ||
      customer.passwordResetExpiresAt < new Date()
    ) {
      throw new BadRequestError('This reset link is invalid or has expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    console.log('[CUSTOMERS] Password reset completed for customer:', customer.id);

    res.json({ message: 'Password reset successfully' });
  })
);

// ===========================================
// CUSTOMER PROFILE MANAGEMENT
// ===========================================

/**
 * GET /api/customers/me
 * Get the current authenticated customer's profile
 */
router.get(
  '/me',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
      throw new NotFoundError('Customer not found');
    }

    res.json(customer);
  })
);

/**
 * PUT /api/customers/me
 * Update the current authenticated customer's profile
 */
router.put(
  '/me',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
        throw new BadRequestError('Username already taken');
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
  })
);

/**
 * POST /api/customers/me/profile-picture
 * Upload a profile picture for the current authenticated customer
 */
router.post(
  '/me/profile-picture',
  authenticateCustomer,
  upload.single('profilePicture'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;

    if (!req.file) {
      throw new BadRequestError('No file uploaded');
    }

    const photoData = await processPhotoToBase64(req.file.buffer);

    const customer = await prisma.customer.update({
      where: { id: authReq.customer.id },
      data: { profilePicture: photoData },
    });

    res.json({ profilePicture: customer.profilePicture });
  })
);

/**
 * PUT /api/customers/me/password
 * Change the password for the current authenticated customer
 */
router.put(
  '/me/password',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const { currentPassword, newPassword } = req.body as PasswordChangeRequest;

    if (!currentPassword || !newPassword) {
      throw new BadRequestError('Current and new password required');
    }

    if (newPassword.length < 6) {
      throw new BadRequestError('Password must be at least 6 characters');
    }

    const customer = await prisma.customer.findUnique({
      where: { id: authReq.customer.id },
    });

    if (!customer || !customer.password) {
      throw new NotFoundError('Customer not found');
    }

    const validPassword = await bcrypt.compare(currentPassword, customer.password);
    if (!validPassword) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.customer.update({
      where: { id: authReq.customer.id },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password updated successfully' });
  })
);

// ===========================================
// CUSTOMER ORDERS & DOWNLOADS
// ===========================================

/**
 * GET /api/customers/me/orders
 * Get all orders for the current authenticated customer
 */
router.get(
  '/me/orders',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  })
);

/**
 * GET /api/customers/me/downloads
 * Get all downloadable beats for the current authenticated customer
 */
router.get(
  '/me/downloads',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  })
);

// ===========================================
// CUSTOMER LIKES
// ===========================================

/**
 * GET /api/customers/me/likes
 * Get all beats liked by the current authenticated customer
 */
router.get(
  '/me/likes',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const likes = await prisma.beatLike.findMany({
      where: { customerId: authReq.customer.id },
      include: {
        beat: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(likes.map((l) => ({ ...l.beat, licensePricing: getLicensePricing(l.beat) })));
  })
);

// ===========================================
// CUSTOMER PLAYLISTS
// ===========================================

/**
 * GET /api/customers/me/playlists
 * Get all playlists for the current authenticated customer
 */
router.get(
  '/me/playlists',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  })
);

/**
 * POST /api/customers/me/playlists
 * Create a new playlist for the current authenticated customer
 */
router.post(
  '/me/playlists',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const { name } = req.body as { name: string };

    if (!name || name.trim().length === 0) {
      throw new BadRequestError('Playlist name is required');
    }

    const playlist = await prisma.playlist.create({
      data: {
        customerId: authReq.customer.id,
        name: name.trim(),
      },
    });

    res.status(201).json(playlist);
  })
);

// ===========================================
// CUSTOMER NOTIFICATIONS
// ===========================================

/**
 * GET /api/customers/me/notifications
 * Get notifications for the current authenticated customer
 */
router.get(
  '/me/notifications',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  })
);

/**
 * GET /api/customers/me/notifications/unread-count
 * Get the count of unread notifications for the current authenticated customer
 */
router.get(
  '/me/notifications/unread-count',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const count = await prisma.notification.count({
      where: {
        customerId: authReq.customer.id,
        isRead: false,
      },
    });

    res.json({ count });
  })
);

/**
 * PUT /api/customers/me/notifications/:id/read
 * Mark a single notification as read
 */
router.put(
  '/me/notifications/:id/read',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const notificationId = parseQueryString(req.params.id);
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        customerId: authReq.customer.id,
      },
    });

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json(updated);
  })
);

/**
 * PUT /api/customers/me/notifications/read-all
 * Mark all notifications as read for the current authenticated customer
 */
router.put(
  '/me/notifications/read-all',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  })
);

/**
 * DELETE /api/customers/me/notifications/:id
 * Delete a notification
 */
router.delete(
  '/me/notifications/:id',
  authenticateCustomer,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedCustomerRequest;
    const notificationId = parseQueryString(req.params.id);
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        customerId: authReq.customer.id,
      },
    });

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    res.json({ message: 'Notification deleted' });
  })
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
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
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
  })
);

/**
 * GET /api/admin/customers/:id
 * Get detailed customer information (admin only)
 */
router.get(
  '/admin/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
      throw new NotFoundError('Customer not found');
    }

    // Remove password from response
    const { password, ...customerData } = customer;
    res.json(customerData);
  })
);

/**
 * PUT /api/admin/customers/:id
 * Update customer information (admin only)
 */
router.put(
  '/admin/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  })
);

/**
 * POST /api/admin/customers/:id/reset-password
 * Reset a customer's password (admin only)
 */
router.post(
  '/admin/:id/reset-password',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const customerId = parseQueryString(req.params.id);
    const { newPassword } = req.body as { newPassword: string };

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestError('Password must be at least 6 characters');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.customer.update({
      where: { id: customerId },
      data: { password: hashedPassword, isGuest: false },
    });

    res.json({ message: 'Password reset successfully' });
  })
);

/**
 * DELETE /api/admin/customers/:id
 * Delete a customer and all related data (admin only)
 */
router.delete(
  '/admin/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
      throw new NotFoundError('Customer not found');
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
  })
);

/**
 * POST /api/admin/customers/:id/block
 * Block a customer (admin only)
 */
router.post(
  '/admin/:id/block',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  })
);

/**
 * POST /api/admin/customers/:id/unblock
 * Unblock a customer (admin only)
 */
router.post(
  '/admin/:id/unblock',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  })
);

/**
 * POST /api/admin/customers/:id/impersonate
 * Generate a customer token for admin to view as customer (admin only)
 */
router.post(
  '/admin/:id/impersonate',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
      throw new NotFoundError('Customer not found');
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
  })
);

export default router;
