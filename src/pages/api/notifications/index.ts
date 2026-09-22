import type { APIRoute } from 'astro';
import { getUserFromCookies } from '../../../lib/auth';
import { db } from '../../../lib/db';
import type { InAppNotification } from '../../../lib/types';

export const GET: APIRoute = async ({ cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const notifications = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(user.id) as InAppNotification[];

  const unreadCount = db
    .prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(user.id) as { count: number };

  return new Response(
    JSON.stringify({
      notifications,
      unreadCount: unreadCount?.count || 0
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
