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

if (!databaseUrl && process.env.NODE_ENV !== 'production') {
  console.warn('NEON_DB_URL not set — database features will fail at runtime');
}

export const sql = neon(databaseUrl || 'postgresql://placeholder:placeholder@localhost/placeholder');
