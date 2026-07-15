/**
 * Sentry error tracking. No-ops entirely if SENTRY_DSN isn't set, so it's
 * safe to import unconditionally - local dev and any environment without
 * a DSN configured just won't report anything.
 */

import * as Sentry from '@sentry/node';
import { config } from '../config/env';

export const sentryEnabled = Boolean(config.sentryDsn);

if (sentryEnabled) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: 0.1,
  });
}

/**
 * Reports an error to Sentry with optional context. Safe to call even when
 * Sentry isn't configured (becomes a no-op).
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!sentryEnabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export { Sentry };
