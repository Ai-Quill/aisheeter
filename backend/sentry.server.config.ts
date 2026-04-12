/**
 * Sentry Server-Side Configuration
 * 
 * Captures unhandled errors on API routes and server components.
 * Only active when SENTRY_DSN is set.
 */

import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Performance: sample 10% of transactions in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Don't send PII
    sendDefaultPii: false,

    // Filter known non-actionable errors
    ignoreErrors: [
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
    ],
  });
}
