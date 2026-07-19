/**
 * Express Application Setup
 * Configures middleware, routes, and error handling
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config/env';
import { Sentry, sentryEnabled } from './services/sentry';
import { errorHandler, notFoundHandler } from './middleware';
import {
  authRouter,
  customersRouter,
  beatsRouter,
  ordersRouter,
  adminRouter,
  bookingsRouter,
  stemsRouter
} from './routes';

// Create Express app
const app: Express = express();

// Render sits behind a reverse proxy - without this, Express can't see the
// real client IP (req.ip resolves to the proxy's address for everyone),
// which breaks IP-based rate limiting by making all visitors share one
// bucket. `1` trusts exactly one hop (Render's own proxy).
app.set('trust proxy', 1);

// Security headers (CSP disabled: this API serves no HTML and CSP would
// only interfere with cross-origin static asset/upload responses)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  config.frontendUrl,
  'https://docrolds.com',
  'https://www.docrolds.com',
  'https://docrolds-staging.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`[CORS] Blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
// Captures the raw request body so webhook handlers (e.g. Square) can verify
// HMAC signatures against the exact bytes that were sent, not a re-serialized copy.
app.use(
  express.json({
    limit: '50mb',
    verify: (req: Request, _res: Response, buf: Buffer) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Request logging in development
if (config.nodeEnv !== 'production') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoints. Render's own uptime probe hits "/" by default
// (not "/health"), which otherwise falls through to the 404 handler and
// logs a spurious [ERROR] on every check.
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'docrolds-api' });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/api/beats', beatsRouter);
app.use('/api/bookings', bookingsRouter); // Booking availability, promos, create
app.use('/api/stems', stemsRouter); // Customer stems upload (Mixing/Mastering bookings)
app.use('/api', ordersRouter); // Orders, checkout, downloads, webhooks
app.use('/api', adminRouter);  // Team, content, photos, admin metrics

// 404 handler for undefined routes
app.use(notFoundHandler);

// Reports errors to Sentry (no-op if SENTRY_DSN isn't configured) before
// they reach our own error handler, which still owns the client response.
if (sentryEnabled) {
  Sentry.setupExpressErrorHandler(app);
}

// Global error handler
app.use(errorHandler);

export default app;
