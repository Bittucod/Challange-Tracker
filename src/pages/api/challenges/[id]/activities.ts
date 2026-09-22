import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db';
import { getUserFromCookies, generateId } from '../../../../lib/auth';
import { isChallengeLocked } from '../../../../lib/stakes';
import type { Challenge, Activity } from '../../../../lib/types';

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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

  const challenge = db
    .prepare('SELECT * FROM challenges WHERE id = ? AND user_id = ?')
    .get(id, user.id);

  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { name, icon = 'target' } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(
        JSON.stringify({ error: 'Activity name is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const currentCount = db
      .prepare('SELECT COUNT(*) as count FROM activities WHERE challenge_id = ?')
      .get(id) as { count: number };

    const actId = generateId();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO activities (id, challenge_id, name, icon, sort_order, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(actId, id, name.trim(), icon.trim(), currentCount.count, now);

    const newActivity = db.prepare('SELECT * FROM activities WHERE id = ?').get(actId);

    return new Response(
      JSON.stringify({ success: true, activity: newActivity }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to add activity' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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

  const challenge = db
    .prepare('SELECT * FROM challenges WHERE id = ? AND user_id = ?')
    .get(id, user.id);

  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { activities = [] } = body;

    // Update sort order and active status for activities
    const updateTx = db.transaction((items: any[]) => {
      const updateStmt = db.prepare(`
        UPDATE activities
        SET name = ?, icon = ?, sort_order = ?, is_active = ?
        WHERE id = ? AND challenge_id = ?
      `);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        updateStmt.run(
          item.name,
          item.icon || 'target',
          i,
          item.is_active !== undefined ? (item.is_active ? 1 : 0) : 1,
          item.id,
          id
        );
      }
    });

    updateTx(activities);

    const updatedList = db
      .prepare('SELECT * FROM activities WHERE challenge_id = ? ORDER BY sort_order ASC')
      .all(id);

    return new Response(
      JSON.stringify({ success: true, activities: updatedList }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to update activities' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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

  // Commitment Lock: Disallow removing activities from active stake challenge
  if (isChallengeLocked(id)) {
    return new Response(
      JSON.stringify({
        error:
          'Activities cannot be removed from a stake-backed challenge because success criteria are locked.'
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(request.url);
  const activityId = url.searchParams.get('activityId');

  if (!activityId) {
    return new Response(JSON.stringify({ error: 'Missing activityId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  db.prepare('DELETE FROM activities WHERE id = ? AND challenge_id = ?').run(
    activityId,
    id
  );

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
