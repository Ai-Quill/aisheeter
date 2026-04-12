import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const prompts = await sql`SELECT * FROM user_prompts WHERE user_id = ${userId}`;

    return NextResponse.json(prompts);
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { name, prompt, variables, user_id } = await request.json();

    console.log('Received user_id:', user_id);

    if (!name || !prompt || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if the user exists
    const [user] = await sql`SELECT id FROM users WHERE id = ${user_id}`;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [data] = await sql`
      INSERT INTO user_prompts (name, prompt, variables, user_id)
      VALUES (${name}, ${prompt}, ${JSON.stringify(variables)}, ${user_id})
      RETURNING *
    `;

    if (!data) {
      return NextResponse.json({ error: 'No data returned from database' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const { id, name, prompt, variables, user_id } = await request.json();

    if (!id || !name || !prompt || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [data] = await sql`
      UPDATE user_prompts
      SET name = ${name}, prompt = ${prompt}, variables = ${JSON.stringify(variables)}
      WHERE id = ${id} AND user_id = ${user_id}
      RETURNING *
    `;

    if (!data) {
      return NextResponse.json({ error: 'Prompt not found or user not authorized' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('user_id');

    if (!id || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    await sql`DELETE FROM user_prompts WHERE id = ${id} AND user_id = ${userId}`;

    return NextResponse.json({ message: 'Prompt deleted successfully' });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
