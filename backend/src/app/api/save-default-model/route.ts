import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const { model, defaultModel, userId } = await req.json()

    await sql`
      UPDATE api_keys
      SET default_model = ${defaultModel}
      WHERE user_id = ${userId} AND model = ${model}
    `

    return NextResponse.json({ message: 'Default model updated successfully' })
  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}