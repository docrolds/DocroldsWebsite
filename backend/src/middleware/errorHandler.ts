/**
 * Error Handling Middleware and Custom Error Classes
 * Provides centralized error handling for the API
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

// ===========================================
// CUSTOM ERROR CLASSES
// ===========================================

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 400 Bad Request - Invalid request data
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', code?: string) {
    super(message, 400, true, code);
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required', code?: string) {
    super(message, 401, true, code);
  }
}

/**
 * 403 Forbidden - Insufficient permissions
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden', code?: string) {
    super(message, 403, true, code);
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code?: string) {
    super(message, 404, true, code);
  }
}

/**
 * 409 Conflict - Resource conflict (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', code?: string) {
    super(message, 409, true, code);
  }
}

/**
 * 422 Unprocessable Entity - Validation error
 */
export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;

  constructor(
    message: string = 'Validation failed',
    errors: Record<string, string[]> = {},
    code?: string
  ) {
    super(message, 422, true, code);
    this.errors = errors;
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Too many requests',
    retryAfter?: number,
    code?: string
  ) {
    super(message, 429, true, code);
    this.retryAfter = retryAfter;
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', code?: string) {
    super(message, 500, true, code);
  }
}

/**
 * 503 Service Unavailable - External service error
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable', code?: string) {
    super(message, 503, true, code);
  }
}

// ===========================================
// ERROR RESPONSE INTERFACE
// ===========================================

interface ErrorResponse {
  message: string;
  statusCode: number;
  code?: string;
  errors?: Record<string, string[]>;
  stack?: string;
}

// ===========================================
// ERROR HANDLER MIDDLEWARE
// ===========================================

/**
 * Global error handler middleware
 * Catches all errors and returns consistent JSON responses
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  // Log error for debugging
  console.error('[ERROR]', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Default error response
  let statusCode = 500;
  let response: ErrorResponse = {
    message: 'Internal server error',
    statusCode: 500,
  };

  // Handle AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    response = {
      message: err.message,
      statusCode: err.statusCode,
      code: err.code,
    };

    // Add validation errors if present
    if (err instanceof ValidationError) {
      response.errors = err.errors;
    }

    // Add retry-after header for rate limit errors
    if (err instanceof RateLimitError && err.retryAfter) {
      res.setHeader('Retry-After', err.retryAfter.toString());
    }
  }
  // Handle Prisma errors
  else if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as { code?: string; meta?: { target?: string[] } };

    switch (prismaError.code) {
      case 'P2002': // Unique constraint violation
        statusCode = 409;
        const fields = prismaError.meta?.target?.join(', ') || 'field';
        response = {
          message: `A record with this ${fields} already exists`,
          statusCode: 409,
          code: 'DUPLICATE_ENTRY',
        };
        break;
      case 'P2025': // Record not found
        statusCode = 404;
        response = {
          message: 'Record not found',
          statusCode: 404,
          code: 'NOT_FOUND',
        };
        break;
      case 'P2003': // Foreign key constraint violation
        statusCode = 400;
        response = {
          message: 'Related record not found',
          statusCode: 400,
          code: 'FOREIGN_KEY_ERROR',
        };
        break;
      default:
        statusCode = 500;
        response = {
          message: 'Database error',
          statusCode: 500,
          code: 'DATABASE_ERROR',
        };
    }
  }
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 403;
    response = {
      message: 'Invalid token',
      statusCode: 403,
      code: 'INVALID_TOKEN',
    };
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 403;
    response = {
      message: 'Token has expired',
      statusCode: 403,
      code: 'TOKEN_EXPIRED',
    };
  }
  // Handle syntax errors (e.g., invalid JSON body)
  else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    response = {
      message: 'Invalid JSON in request body',
      statusCode: 400,
      code: 'INVALID_JSON',
    };
  }

  // Include stack trace in development/staging
  if (config.nodeEnv !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler for undefined routes
 * Place this after all route definitions
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError(
    `Cannot ${req.method} ${req.path}`,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

// ===========================================
// ASYNC HANDLER WRAPPER
// ===========================================

/**
 * Type for async Express route handlers
 */
type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

/**
 * Wraps async route handlers to catch promise rejections
 * Eliminates the need for try-catch blocks in every route
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await prisma.user.findMany();
 *   res.json(users);
 * }));
 */
export const asyncHandler = (fn: AsyncHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Creates an async handler with typed request
 * Useful when working with authenticated requests
 *
 * @example
 * router.get('/profile', authenticateCustomer, typedAsyncHandler<AuthenticatedCustomerRequest>(
 *   async (req, res) => {
 *     const customer = await prisma.customer.findUnique({ where: { id: req.customer.id } });
 *     res.json(customer);
 *   }
 * ));
 */
export function typedAsyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void | Response>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Asserts a condition and throws an error if false
 * Useful for validation in route handlers
 *
 * @example
 * assertOrThrow(user !== null, new NotFoundError('User not found'));
 */
export function assertOrThrow(
  condition: unknown,
  error: AppError
): asserts condition {
  if (!condition) {
    throw error;
  }
}

/**
 * Asserts that a value exists (not null/undefined)
 *
 * @example
 * const user = await prisma.user.findUnique({ where: { id } });
 * assertExists(user, 'User', id);
 * // user is now typed as non-null
 */
export function assertExists<T>(
  value: T | null | undefined,
  resourceName: string,
  identifier?: string
): asserts value is T {
  if (value === null || value === undefined) {
    const message = identifier
      ? `${resourceName} with ID '${identifier}' not found`
      : `${resourceName} not found`;
    throw new NotFoundError(message);
  }
}
