/**
 * Structured Logger
 * 
 * Wraps pino for structured JSON logging in production.
 * In development, falls back to console for readability.
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info({ userId, command }, 'Processing parse-chain');
 *   logger.error({ err, jobId }, 'Job processing failed');
 * 
 * Each log entry includes:
 * - timestamp (ISO)
 * - level (info, warn, error)
 * - msg (human-readable message)
 * - structured data (any extra fields)
 * 
 * @version 1.0.0
 */

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  // JSON in production (for log aggregation), pretty in dev
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino/file',
          options: { destination: 1 }, // stdout
        },
      }),
  // Add service name for filtering in log aggregators
  base: {
    service: 'ai-sheet-backend',
    ...(process.env.VERCEL_GIT_COMMIT_SHA
      ? { commit: process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7) }
      : {}),
  },
  // Redact sensitive fields
  redact: {
    paths: ['encryptedApiKey', 'apiKey', 'req.headers.authorization'],
    censor: '[REDACTED]',
  },
});

/**
 * Create a child logger with bound context.
 * Useful for adding requestId, userId, etc. to all logs in a request.
 * 
 * @example
 * const log = createRequestLogger({ userId: 'abc', route: 'parse-chain' });
 * log.info('Starting workflow generation');
 * log.error({ err }, 'Failed to generate workflow');
 */
export function createRequestLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
