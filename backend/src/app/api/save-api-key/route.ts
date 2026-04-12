import { NextResponse } from 'next/server'
import { sql } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { model, apiKey, userEmail } = await req.json()

    // Log the received data (be careful not to log the full API key in production)
    console.log('Received data:', { model, userEmail, apiKeyLength: apiKey?.length })

    if (!model || !apiKey || !userEmail) {
      console.error('Missing required fields:', { model: !!model, apiKey: !!apiKey, userEmail: !!userEmail })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await sql`
      INSERT INTO api_keys (user_email, model, api_key)
      VALUES (${userEmail}, ${model}, ${apiKey})
      ON CONFLICT (user_email, model) DO UPDATE SET api_key = ${apiKey}
    `

    console.log('API key saved successfully:', { userEmail, model })
    return NextResponse.json({ message: 'API key saved successfully' })
  } catch (error: unknown) {
    console.error('Caught error:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    } else {
      console.error('Non-Error object thrown:', String(error))
    }
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}