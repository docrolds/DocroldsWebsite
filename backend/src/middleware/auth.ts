/**
 * Authentication Middleware
 * Handles JWT token verification for admin and customer routes
 */

import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';
import type {
  AdminJwtPayload,
  CustomerJwtPayload,
  AuthenticatedAdminRequest,
  AuthenticatedCustomerRequest,
  OptionalCustomerRequest,
} from '../types';
import { UnauthorizedError, ForbiddenError } from './errorHandler';

const prisma = new PrismaClient();

/**
 * Extracts Bearer token from Authorization header
 * @param req - Express request object
 * @returns The token string or null if not present
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verifies a JWT token and returns the decoded payload
 * @param token - JWT token string
 * @param secret - Secret key for verification
 * @returns Promise resolving to decoded payload
 */
function verifyToken<T>(token: string, secret: string): Promise<T> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as T);
      }
    });
  });
}

/**
 * Middleware to authenticate admin users
 * Verifies JWT token and attaches user payload to req.user
 *
 * @throws UnauthorizedError if no token is provided
 * @throws ForbiddenError if token is invalid or expired
 */
export const authenticateAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new UnauthorizedError('Access denied. No token provided.');
    }

    const decoded = await verifyToken<AdminJwtPayload>(
      token,
      config.auth.jwtSecret
    );

    // Attach user payload to request
    (req as AuthenticatedAdminRequest).user = decoded;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new ForbiddenError('Invalid token.'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new ForbiddenError('Token has expired.'));
    } else {
      next(new ForbiddenError('Failed to authenticate token.'));
    }
  }
};

/**
 * Alias for authenticateAdmin for backward compatibility
 */
export const authenticateToken = authenticateAdmin;

/**
 * Middleware to authenticate customer users
 * Verifies JWT token and attaches customer payload to req.customer
 * Also checks if customer is blocked
 *
 * @throws UnauthorizedError if no token is provided
 * @throws ForbiddenError if token is invalid, expired, or customer is blocked
 */
export const authenticateCustomer = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new UnauthorizedError('Access denied. No token provided.');
    }

    const decoded = await verifyToken<CustomerJwtPayload>(
      token,
      config.auth.jwtCustomerSecret
    );

    // Check if customer is blocked
    const customer = await prisma.customer.findUnique({
      where: { id: decoded.id },
      select: { isBlocked: true, blockedReason: true },
    });

    if (!customer) {
      throw new ForbiddenError('Customer account not found.');
    }

    if (customer.isBlocked) {
      const reason = customer.blockedReason
        ? `: ${customer.blockedReason}`
        : '';
      throw new ForbiddenError(`Your account has been blocked${reason}`);
    }

    // Attach customer payload to request
    (req as AuthenticatedCustomerRequest).customer = decoded;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      next(error);
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new ForbiddenError('Invalid token.'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new ForbiddenError('Token has expired.'));
    } else {
      next(new ForbiddenError('Failed to authenticate token.'));
    }
  }
};

/**
 * Middleware for optional customer authentication
 * If a valid token is provided, attaches customer to req.customer
 * If no token or invalid token, continues without error
 *
 * Use this for endpoints that work with or without authentication
 * (e.g., getting like status where authenticated users see their own status)
 */
export const optionalCustomerAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      // No token provided, continue without authentication
      return next();
    }

    const decoded = await verifyToken<CustomerJwtPayload>(
      token,
      config.auth.jwtCustomerSecret
    );

    // Optionally check if customer is blocked (silent fail for optional auth)
    const customer = await prisma.customer.findUnique({
      where: { id: decoded.id },
      select: { isBlocked: true },
    });

    // Only attach customer if they exist and are not blocked
    if (customer && !customer.isBlocked) {
      (req as OptionalCustomerRequest).customer = decoded;
    }

    next();
  } catch {
    // For optional auth, any error just means we continue without authentication
    next();
  }
};

/**
 * Middleware to require a specific admin role
 * Must be used after authenticateAdmin
 *
 * @param roles - Array of allowed roles
 * @throws ForbiddenError if user doesn't have required role
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedAdminRequest).user;

    if (!user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    if (!roles.includes(user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Required role: ${roles.join(' or ')}`
        )
      );
    }

    next();
  };
};

/**
 * Alias for requireRole('admin') for backward compatibility
 */
export const requireAdmin = requireRole('admin');

/**
 * Helper to generate admin JWT token
 * @param payload - Admin user payload
 * @param expiresIn - Token expiration time (default: 24h)
 * @returns JWT token string
 */
export function generateAdminToken(
  payload: Omit<AdminJwtPayload, 'iat' | 'exp'>,
  expiresIn: SignOptions['expiresIn'] = '24h'
): string {
  return jwt.sign(payload, config.auth.jwtSecret, { expiresIn });
}

/**
 * Helper to generate customer JWT token
 * @param payload - Customer payload
 * @param expiresIn - Token expiration time (default: 7d)
 * @returns JWT token string
 */
export function generateCustomerToken(
  payload: Omit<CustomerJwtPayload, 'iat' | 'exp'>,
  expiresIn: SignOptions['expiresIn'] = '7d'
): string {
  return jwt.sign(payload, config.auth.jwtCustomerSecret, { expiresIn });
}

/**
 * Helper to generate impersonation token for admin to act as customer
 * @param customerId - Customer ID to impersonate
 * @param customerEmail - Customer email
 * @param adminId - Admin ID performing impersonation
 * @param expiresIn - Token expiration time (default: 1h for security)
 * @returns JWT token string
 */
export function generateImpersonationToken(
  customerId: string,
  customerEmail: string,
  adminId: string,
  expiresIn: SignOptions['expiresIn'] = '1h'
): string {
  const payload: Omit<CustomerJwtPayload, 'iat' | 'exp'> = {
    id: customerId,
    email: customerEmail,
    impersonatedBy: adminId,
  };
  return jwt.sign(payload, config.auth.jwtCustomerSecret, { expiresIn });
}
