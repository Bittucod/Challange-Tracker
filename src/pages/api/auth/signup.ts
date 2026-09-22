import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import {
  generateId,
  hashPassword,
  createSession,
  setSessionCookie
} from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'Name must be at least 2 characters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid email address.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return new Response(
        JSON.stringify({ error: 'An account with this email already exists.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userId = generateId();
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, name, created_at, preferences)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertUser.run(userId, cleanEmail, passwordHash, name.trim(), now, '{}');

    // Create unique personal invite code
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    db.prepare(`
      INSERT INTO invites (id, inviter_id, code, uses_count, created_at)
      VALUES (?, ?, ?, 0, ?)
    `).run(generateId(), userId, inviteCode, now);

    // Create session and set cookie
    const sessionId = createSession(userId);
    setSessionCookie(cookies, sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: userId, email: cleanEmail, name: name.trim() }
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Signup error:', err);
    return new Response(
      JSON.stringify({ error: 'Unable to create account. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
