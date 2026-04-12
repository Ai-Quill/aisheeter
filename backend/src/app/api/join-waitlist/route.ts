import { NextResponse } from 'next/server'
import { sql } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    await sql`
      INSERT INTO waitlist (email)
      VALUES (${email})
      ON CONFLICT (email) DO NOTHING
    `

    return NextResponse.json({ message: 'Successfully joined waitlist' })
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}