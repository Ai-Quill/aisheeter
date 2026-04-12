import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface ApiKeyData {
  model: string;
  api_key: string;
  default_model: string;
}

interface Settings {
  [key: string]: {
    apiKey: string;
    defaultModel: string;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userEmail = searchParams.get('userEmail');
  const userId = searchParams.get('userId');

  if (!userEmail && !userId) {
    return NextResponse.json({ error: 'User identification is required' }, { status: 400 });
  }

  try {
    let actualUserId = userId;

    if (!actualUserId) {
      // First, get the user_id from the email
      const [userData] = await sql`SELECT id FROM users WHERE email = ${userEmail}`;

      if (!userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      actualUserId = userData.id;
    }

    const data = await sql`
      SELECT model, api_key, default_model FROM api_keys WHERE user_id = ${actualUserId}
    ` as ApiKeyData[];

    // Transform the data into the expected format
    const settings: Settings = data.reduce((acc, item) => {
      acc[item.model] = {
        apiKey: item.api_key,
        defaultModel: item.default_model
      };
      return acc;
    }, {} as Settings);

    console.log('User settings:', JSON.stringify(settings, null, 2));

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json({ error: 'Failed to fetch user settings' }, { status: 500 });
  }
}
