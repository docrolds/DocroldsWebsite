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
