/**
 * Robots.txt for AISheeter
 * 
 * Allows all crawlers on public pages.
 * Blocks API routes and Next.js internals.
 */

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/'],
      },
    ],
    sitemap: 'https://www.aisheeter.com/sitemap.xml',
  };
}
