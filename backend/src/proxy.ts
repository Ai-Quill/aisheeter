/**
 * Next.js Middleware
 * 
 * Runs before every matched request. Handles:
 * 1. Security headers (CSP, X-Frame-Options, etc.)
 * 2. CORS preflight for API routes
 * 
 * Note: Rate limiting is done at the route level (not middleware)
 * because we need the request body to extract the user identifier.
 * 
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllowedOrigin, getCorsHeaders } from '@/lib/security/cors';

// ============================================
// SECURITY HEADERS
// ============================================

const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// ============================================
// MIDDLEWARE
// ============================================

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  // --- CORS Preflight (OPTIONS) for API routes ---
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    const corsHeaders = getCorsHeaders(origin);
    return new NextResponse(null, {
      status: 204,
      headers: { ...corsHeaders, ...securityHeaders },
    });
  }

  // --- Normal requests ---
  const response = NextResponse.next();

  // Add security headers to all responses
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  // Add CORS headers to API responses when origin is present
  if (pathname.startsWith('/api/') && origin) {
    const corsHeaders = getCorsHeaders(origin);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

// Only run middleware on API routes and pages (skip static assets)
export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
