import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { getUserFromCookies, generateId } from '../../lib/auth';
import type { Invite } from '../../lib/types';

export const GET: APIRoute = async ({ cookies, url }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let invite = db
    .prepare('SELECT * FROM invites WHERE inviter_id = ? ORDER BY created_at DESC')
    .get(user.id) as Invite | undefined;

  if (!invite) {
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const now = new Date().toISOString();
    const id = generateId();
    db.prepare(`
      INSERT INTO invites (id, inviter_id, code, uses_count, created_at)
      VALUES (?, ?, ?, 0, ?)
    `).run(id, user.id, inviteCode, now);
    invite = { id, inviter_id: user.id, code: inviteCode, uses_count: 0, created_at: now };
  }

  const origin = url.origin || 'http://localhost:4321';
  const inviteUrl = `${origin}/invite/${invite.code}`;

  return new Response(
    JSON.stringify({
      code: invite.code,
      url: inviteUrl,
      uses_count: invite.uses_count
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
