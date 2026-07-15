/**
 * Authentication Routes
 * Handles admin login, unified login, admin setup, and user management
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';
import {
  authenticateToken,
  requireAdmin,
  generateAdminToken,
  generateCustomerToken,
  authLimiter,
} from '../middleware';
import {
  asyncHandler,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../middleware';
import type {
  AdminLoginRequest,
  AdminLoginResponse,
  AuthenticatedAdminRequest,
  SafeUser,
} from '../types';

const router = Router();
const prisma = new PrismaClient();

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Parses a query string parameter that may be a string or array
 * Returns the first element if array, or the value itself if string
 */
function parseQueryString(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) {
    return param[0];
  }
  return param;
}

/**
 * Validates email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ===========================================
// ADMIN SETUP ROUTE
// ===========================================

/**
 * POST /api/auth/admin-setup
 * Protected: Only works if no admin exists yet
 * Sets up the initial admin user from environment variables
 */
router.post(
  '/admin-setup',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'admin' },
    });

    if (existingAdmin) {
      throw new ForbiddenError(
        'Admin already configured. Use admin panel to manage users.'
      );
    }

    const hashedPassword = await bcrypt.hash(config.auth.adminPassword, 12);

    const result = await prisma.user.create({
      data: {
        username: config.auth.adminUsername,
        email: 'admin@docrolds.com',
        password: hashedPassword,
        role: 'admin',
      },
    });

    res.json({
      message: 'Admin user configured successfully',
      user: {
        id: result.id,
        username: result.username,
        email: result.email,
        role: result.role,
      },
    });
  })
);

// ===========================================
// ADMIN LOGIN ROUTE
// ===========================================

/**
 * POST /api/auth/login
 * Admin login endpoint
 */
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body as AdminLoginRequest;

    if (!username || !password) {
      throw new BadRequestError('Username and password are required');
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new BadRequestError('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      throw new BadRequestError('Invalid credentials');
    }

    const token = generateAdminToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    const response: AdminLoginResponse = {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };

    res.json(response);
  })
);

// ===========================================
// UNIFIED LOGIN ROUTE
// ===========================================

/**
 * Request body for unified login
 */
interface UnifiedLoginRequest {
  email: string;
  password: string;
}

/**
 * Response for unified login (can be admin or customer)
 */
interface UnifiedLoginResponse {
  token: string;
  role: 'admin' | 'customer';
  user?: {
    id: string;
    username: string;
    email: string | null;
    role: string;
  };
  customer?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    stageName: string | null;
    profilePicture: string | null;
  };
}

/**
 * POST /api/auth/unified-login
 * Checks both Admin (User) and Customer tables
 * Returns appropriate token and user/customer info based on account type
 */
router.post(
  '/unified-login',
  authLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as UnifiedLoginRequest;

    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    // First, check if it's an admin user (by username or email)
    const adminUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: email }, { email: email }],
      },
    });

    if (adminUser) {
      const validPassword = await bcrypt.compare(password, adminUser.password);
      if (validPassword) {
        const token = generateAdminToken({
          id: adminUser.id,
          username: adminUser.username,
          role: adminUser.role,
        });

        const response: UnifiedLoginResponse = {
          token,
          role: 'admin',
          user: {
            id: adminUser.id,
            username: adminUser.username,
            email: adminUser.email,
            role: adminUser.role,
          },
        };

        res.json(response);
        return;
      }
    }

    // If not admin, check customer table
    const customer = await prisma.customer.findUnique({
      where: { email },
    });

    if (customer && !customer.isGuest && customer.password) {
      // Check if customer is blocked
      if (customer.isBlocked) {
        throw new ForbiddenError(
          customer.blockedReason ||
            'Your account has been blocked. Please contact support.'
        );
      }

      const validPassword = await bcrypt.compare(password, customer.password);
      if (validPassword) {
        const token = generateCustomerToken({
          id: customer.id,
          email: customer.email,
        });

        const response: UnifiedLoginResponse = {
          token,
          role: 'customer',
          customer: {
            id: customer.id,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            stageName: customer.stageName,
            profilePicture: customer.profilePicture,
          },
        };

        res.json(response);
        return;
      }
    }

    // No match found
    throw new BadRequestError('Invalid credentials');
  })
);

// ===========================================
// USER MANAGEMENT ROUTES (Admin only)
// ===========================================

/**
 * GET /api/users
 * Get all admin users
 * Admin only
 */
router.get(
  '/users',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    res.json(users);
  })
);

/**
 * Request body for creating a new user
 */
interface CreateUserRequest {
  username: string;
  email?: string;
  password: string;
  role?: string;
}

/**
 * POST /api/users
 * Create a new admin user
 * Admin only
 */
router.post(
  '/users',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { username, email, password, role } = req.body as CreateUserRequest;

    // Input validation
    if (!username || username.length < 3) {
      throw new BadRequestError('Username must be at least 3 characters');
    }
    if (!password || password.length < 6) {
      throw new BadRequestError('Password must be at least 6 characters');
    }
    if (email && !isValidEmail(email)) {
      throw new BadRequestError('Invalid email format');
    }

    // Check for existing user
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUser) {
      throw new ConflictError('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await prisma.user.create({
      data: {
        username,
        email: email || null,
        password: hashedPassword,
        role: role || 'user',
      },
    });

    // Return user without password
    const userResponse: SafeUser = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
    };

    res.status(201).json(userResponse);
  })
);

/**
 * Request body for updating a user
 */
interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
}

/**
 * PUT /api/users/:id
 * Update an admin user
 * Admin only
 */
router.put(
  '/users/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = parseQueryString(req.params.id);
    const { username, email, password, role } = req.body as UpdateUserRequest;

    // Find existing user
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Input validation
    if (username && username.length < 3) {
      throw new BadRequestError('Username must be at least 3 characters');
    }
    if (password && password.length < 6) {
      throw new BadRequestError('Password must be at least 6 characters');
    }
    if (email && !isValidEmail(email)) {
      throw new BadRequestError('Invalid email format');
    }

    // Check username uniqueness if changed
    if (username && username !== user.username) {
      const existing = await prisma.user.findUnique({
        where: { username },
      });
      if (existing) {
        throw new ConflictError('Username already exists');
      }
    }

    // Build update data
    const updateData: {
      username?: string;
      email?: string;
      password?: string;
      role?: string;
    } = {};

    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Return user without password
    const userResponse: SafeUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt,
    };

    res.json(userResponse);
  })
);

/**
 * DELETE /api/users/:id
 * Delete an admin user
 * Admin only
 */
router.delete(
  '/users/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = parseQueryString(req.params.id);

    // Check if user exists before deleting
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Prevent deleting self
    const authReq = req as AuthenticatedAdminRequest;
    if (authReq.user && authReq.user.id === id) {
      throw new BadRequestError('Cannot delete your own account');
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: 'User deleted successfully' });
  })
);

export default router;
