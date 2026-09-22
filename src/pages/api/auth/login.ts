import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import {
  verifyPassword,
  createSession,
  setSessionCookie
} from '../../../lib/auth';
import type { User } from '../../../lib/types';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Please provide both email and password.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as User | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email or password.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sessionId = createSession(user.id);
    setSessionCookie(cookies, sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: user.id, email: user.email, name: user.name }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Login error:', err);
    return new Response(
      JSON.stringify({ error: 'Unable to sign in. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
