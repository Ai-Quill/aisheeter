import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface SettingsData {
  apiKey: string;
  defaultModel: string;
}

interface SaveSettingsData {
  apiKey: string;
  defaultModel: string;
}

async function getOrCreateUser(userEmail: string): Promise<string> {
  const [existingUser] = await sql`SELECT id FROM users WHERE email = ${userEmail}`;

  if (existingUser) {
    return existingUser.id;
  }

  const [newUser] = await sql`INSERT INTO users (email) VALUES (${userEmail}) RETURNING id`;

  if (!newUser) {
    throw new Error('Failed to create new user');
  }

  return newUser.id;
}

export async function POST(request: Request) {
  console.log('Received POST request');
  
  let userEmail, userId, settings;
  try {
    const body = await request.json();
    console.log('Received body:', body);
    ({ userEmail, userId, settings } = body);
    console.log('Parsed request body:', { userEmail, userId, settings });
  } catch (error) {
    console.error('Error parsing request body:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if ((!userEmail && !userId) || !settings) {
    console.error('Missing required fields:', { userEmail, userId, settings });
    return NextResponse.json({ error: 'User identification and settings are required' }, { status: 400 });
  }

  try {
    // Get or create user
    let actualUserId = userId;
    if (!actualUserId) {
      actualUserId = await getOrCreateUser(userEmail);
    }
    console.log('User ID:', actualUserId);

    const apiKeys = Object.entries(settings).map(([model, data]) => {
      console.log('Processing model:', model, 'with data:', data);
      return {
        user_id: actualUserId,
        model,
        api_key: (data as SaveSettingsData).apiKey,
        default_model: (data as SaveSettingsData).defaultModel
      };
    });
    console.log('Prepared apiKeys for upsert:', apiKeys);

    // Perform upsert for each API key individually
    await Promise.all(apiKeys.map(async (apiKey) => {
      await sql`
        INSERT INTO api_keys (user_id, model, api_key, default_model)
        VALUES (${apiKey.user_id}, ${apiKey.model}, ${apiKey.api_key}, ${apiKey.default_model})
        ON CONFLICT (user_id, model) DO UPDATE SET
          api_key = ${apiKey.api_key},
          default_model = ${apiKey.default_model}
      `;
    }));

    console.log('Upsert successful');
    return NextResponse.json({ message: 'Settings saved successfully', userId: actualUserId });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

export interface Settings {
  [key: string]: SettingsData;
}
