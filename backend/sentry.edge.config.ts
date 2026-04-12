/**
 * Sentry Edge Runtime Configuration
 * 
 * For Edge-runtime API routes (like /api/jobs/stream).
 * Only active when SENTRY_DSN is set.
 */

import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
  });
}
