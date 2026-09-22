import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db';
import { getUserFromCookies, generateId } from '../../../../lib/auth';
import type { Reaction } from '../../../../lib/types';

export const GET: APIRoute = async ({ params, cookies }) => {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing challenge ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const user = getUserFromCookies(cookies);

  // Group counts by reaction type
  const counts = db
    .prepare(`
      SELECT type, COUNT(*) as count
      FROM reactions
      WHERE challenge_id = ?
      GROUP BY type
    `)
    .all(id) as Array<{ type: string; count: number }>;

  const reactionCounts: Record<string, number> = { heart: 0, fire: 0, clap: 0 };
  counts.forEach((c) => {
    reactionCounts[c.type] = c.count;
  });

  // Check which reactions the current user has selected
  let userReactions: string[] = [];
  if (user) {
    const rows = db
      .prepare('SELECT type FROM reactions WHERE challenge_id = ? AND user_id = ?')
      .all(id, user.id) as Array<{ type: string }>;
    userReactions = rows.map((r) => r.type);
  }

  return new Response(
    JSON.stringify({
      counts: reactionCounts,
      userReactions
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Please sign in to react.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing challenge ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { type } = body;

    if (!['heart', 'fire', 'clap'].includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid reaction type.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Toggle reaction: remove if already exists, else insert
    const existing = db
      .prepare('SELECT * FROM reactions WHERE challenge_id = ? AND user_id = ? AND type = ?')
      .get(id, user.id, type) as Reaction | undefined;

    let action: 'added' | 'removed' = 'added';

    if (existing) {
      db.prepare('DELETE FROM reactions WHERE id = ?').run(existing.id);
      action = 'removed';
    } else {
      const rxId = generateId();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO reactions (id, challenge_id, user_id, type, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(rxId, id, user.id, type, now);
      action = 'added';
    }

    // Return updated totals
    const counts = db
      .prepare(`
        SELECT type, COUNT(*) as count
        FROM reactions
        WHERE challenge_id = ?
        GROUP BY type
      `)
      .all(id) as Array<{ type: string; count: number }>;

    const reactionCounts: Record<string, number> = { heart: 0, fire: 0, clap: 0 };
    counts.forEach((c) => {
      reactionCounts[c.type] = c.count;
    });

    const userRows = db
      .prepare('SELECT type FROM reactions WHERE challenge_id = ? AND user_id = ?')
      .all(id, user.id) as Array<{ type: string }>;

    return new Response(
      JSON.stringify({
        success: true,
        action,
        counts: reactionCounts,
        userReactions: userRows.map((r) => r.type)
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Reaction toggle error:', err);
    return new Response(JSON.stringify({ error: 'Failed to toggle reaction.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
