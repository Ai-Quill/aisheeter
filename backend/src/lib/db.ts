/**
 * Neon Database Client
 * 
 * Direct SQL via @neondatabase/serverless HTTP driver.
 * Uses tagged template literals for parameterized queries (SQL injection safe).
 * No ORM — queries are raw SQL for full control and transparency.
 * 
 * Edge-compatible (HTTP-based, no persistent TCP connections).
 * 
 * @example
 *   import { sql } from '@/lib/db';
 *   const users = await sql`SELECT * FROM users WHERE email = ${email}`;
 *   const [user] = await sql`SELECT id FROM users WHERE id = ${id}`;
 */

import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.NEON_DB_URL;

if (!databaseUrl) {
  throw new Error('NEON_DB_URL environment variable is required');
}

export const sql = neon(databaseUrl);
