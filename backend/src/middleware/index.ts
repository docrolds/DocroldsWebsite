/**
 * Middleware Exports
 * Central export file for all middleware
 */

// ===========================================
// AUTHENTICATION MIDDLEWARE
// ===========================================

export {
  // Primary auth middleware
  authenticateAdmin,
  authenticateCustomer,
  optionalCustomerAuth,
  requireRole,

  // Backward compatibility aliases
  authenticateToken,
  requireAdmin,

  // Token generation helpers
  generateAdminToken,
  generateCustomerToken,
  generateImpersonationToken,
} from './auth';

// ===========================================
// ERROR HANDLING MIDDLEWARE & CLASSES
// ===========================================

export {
  // Error handler middleware
  errorHandler,
  notFoundHandler,

  // Async handler wrapper
  asyncHandler,
  typedAsyncHandler,

  // Custom error classes
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalError,
  ServiceUnavailableError,

  // Assertion utilities
  assertOrThrow,
  assertExists,
} from './errorHandler';
