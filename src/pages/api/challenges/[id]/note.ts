import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db';
import { getUserFromCookies, generateId } from '../../../../lib/auth';
import type { Challenge, DailyRecord } from '../../../../lib/types';

// GET: Retrieve private notes for a challenge (authenticated owner only)
export const GET: APIRoute = async ({ params, cookies }) => {
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

  // Strictly verify challenge ownership
  const challenge = db
    .prepare('SELECT id FROM challenges WHERE id = ? AND user_id = ?')
    .get(id, user.id) as Challenge | undefined;

  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const notes = db
    .prepare(
      "SELECT activity_id, date, note, updated_at FROM daily_records WHERE challenge_id = ? AND note IS NOT NULL AND note != ''"
    )
    .all(id);

  return new Response(JSON.stringify({ notes }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

// POST / PATCH: Create or update a note for a daily cell (authenticated owner only)
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

  // Strictly verify challenge ownership
  const challenge = db
    .prepare('SELECT id FROM challenges WHERE id = ? AND user_id = ?')
    .get(id, user.id) as Challenge | undefined;

  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { activity_id, date, note } = body;

    if (!activity_id || !date) {
      return new Response(
        JSON.stringify({ error: 'activity_id and date are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const noteContent = typeof note === 'string' ? note.trim().slice(0, 500) : '';
    const now = new Date().toISOString();

    const existing = db
      .prepare(
        'SELECT * FROM daily_records WHERE challenge_id = ? AND activity_id = ? AND date = ?'
      )
      .get(id, activity_id, date) as DailyRecord | undefined;

    if (existing) {
      db.prepare(`
        UPDATE daily_records
        SET note = ?, updated_at = ?
        WHERE id = ?
      `).run(noteContent, now, existing.id);
    } else {
      db.prepare(`
        INSERT INTO daily_records (
          id, challenge_id, activity_id, date, status, note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
      `).run(
        generateId(),
        id,
        activity_id,
        date,
        noteContent,
        now,
        now
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        record: {
          activity_id,
          date,
          note: noteContent
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Note create/update error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to save note' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// DELETE: Delete a note for a daily cell (authenticated owner only)
export const DELETE: APIRoute = async ({ params, request, url, cookies }) => {
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

  // Strictly verify challenge ownership
  const challenge = db
    .prepare('SELECT id FROM challenges WHERE id = ? AND user_id = ?')
    .get(id, user.id) as Challenge | undefined;

  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    let activity_id = url.searchParams.get('activity_id');
    let date = url.searchParams.get('date');

    // Also check body if not in query params
    if (!activity_id || !date) {
      try {
        const body = await request.json();
        if (body.activity_id) activity_id = body.activity_id;
        if (body.date) date = body.date;
      } catch {
        // Body was empty or not json, ignore
      }
    }

    if (!activity_id || !date) {
      return new Response(
        JSON.stringify({ error: 'activity_id and date are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE daily_records
      SET note = '', updated_at = ?
      WHERE challenge_id = ? AND activity_id = ? AND date = ?
    `).run(now, id, activity_id, date);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Note deleted'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Note deletion error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to delete note' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
