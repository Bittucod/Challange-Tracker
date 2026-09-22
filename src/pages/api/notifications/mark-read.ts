import type { APIRoute } from 'astro';
import { getUserFromCookies } from '../../../lib/auth';
import { db } from '../../../lib/db';

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { notificationId } = body;

    if (notificationId) {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notificationId, user.id);
    } else {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(user.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to update notifications' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
