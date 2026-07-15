/**
 * Error tracking. No-ops entirely if VITE_SENTRY_DSN isn't set, so it's
 * safe to import unconditionally - local dev and any environment without
 * a DSN configured just won't report anything.
 */

import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

export const sentryEnabled = Boolean(dsn);

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
