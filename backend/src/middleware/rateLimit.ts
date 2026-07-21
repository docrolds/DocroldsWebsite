/**
 * Rate Limiting Middleware
 * Throttles brute-force/abuse-prone endpoints (auth, checkout, booking creation)
 */

import rateLimit from 'express-rate-limit';

const jsonHandler = (message: string) => (
  _req: import('express').Request,
  res: import('express').Response
) => {
  res.status(429).json({ message, statusCode: 429, code: 'RATE_LIMITED' });
};

/**
 * Login/registration endpoints - protects against credential stuffing
 * and account enumeration.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later.' },
  handler: jsonHandler('Too many attempts, please try again later.'),
});

/**
 * Payment-initiating endpoints (checkout, booking creation) - protects
 * against card-testing/carding abuse against the Square integration.
 */
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many payment attempts, please try again later.' },
  handler: jsonHandler('Too many payment attempts, please try again later.'),
});

/**
 * Large-file-upload endpoints (stems submission) - the route is already
 * token-gated per booking, but each request can buffer up to ~1.2GB in
 * memory before uploading to R2, so unbounded concurrent/repeat requests
 * are still a cheap storage/memory-abuse vector worth throttling.
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many upload attempts, please try again later.' },
  handler: jsonHandler('Too many upload attempts, please try again later.'),
});
