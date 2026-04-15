/**
 * CORS Configuration
 * 
 * Google Apps Script's UrlFetchApp makes server-side requests (no CORS needed).
 * Browser requests (landing page, testing) need proper CORS headers.
 * 
 * We use a permissive allow-list because our API is authenticated via
 * encrypted API keys — CORS is defense-in-depth, not primary auth.
 * 
 * @version 1.0.0
 */

/**
 * Allowed origins for CORS.
 * Google Apps Script requests don't include Origin headers,
 * so they bypass CORS entirely (server-to-server).
 */
const ALLOWED_ORIGINS = [
  // Production
  'https://ai-sheeter.vercel.app',
  'https://www.aisheeter.com',
  'https://aisheeter.com',
  // Vercel preview deployments
  /^https:\/\/ai-sheeter-.*\.vercel\.app$/,
  // GAS sidebar iframes (sidebar fetch() calls for plan progress polling)
  /^https:\/\/.*-script\.googleusercontent\.com$/,
];

/**
 * Check if an origin is allowed.
 * Returns the origin if allowed, or null if not.
 * 
 * Google Apps Script requests have no Origin header — these are
 * server-to-server and don't need CORS at all.
 */
export function getAllowedOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;

  // Allow localhost in development
  if (process.env.NODE_ENV === 'development' && requestOrigin.startsWith('http://localhost')) {
    return requestOrigin;
  }

  // Check static origins
  if (ALLOWED_ORIGINS.some(allowed => 
    typeof allowed === 'string' ? allowed === requestOrigin : allowed.test(requestOrigin)
  )) {
    return requestOrigin;
  }

  // Check custom override (for custom domains)
  const customOrigin = process.env.CORS_ALLOWED_ORIGIN;
  if (customOrigin && customOrigin === requestOrigin) {
    return requestOrigin;
  }

  return null;
}

/**
 * Build CORS headers for a response.
 * Only sets Access-Control-Allow-Origin if the origin is allowed.
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowedOrigin = getAllowedOrigin(requestOrigin);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}
