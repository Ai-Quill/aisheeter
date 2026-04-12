import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: Request): Promise<Response> {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Try to get existing user
    const [user] = await sql`SELECT id FROM users WHERE email = ${email}`;

    if (user) {
      return NextResponse.json({ userId: user.id });
    }

    // User doesn't exist, create a new one
    const [newUser] = await sql`
      INSERT INTO users (email) VALUES (${email}) RETURNING *
    `;

    if (!newUser) {
      throw new Error('Failed to get or create user');
    }

    return NextResponse.json({ userId: newUser.id });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
