import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db';
import { getUserFromCookies, generateId } from '../../../../lib/auth';
import {
  calculateChallengeAnalytics,
  checkMilestones
} from '../../../../lib/engine';
import type { Challenge, Activity, DailyRecord, Milestone } from '../../../../lib/types';

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { id } = params;
  const challenge = db
    .prepare('SELECT * FROM challenges WHERE id = ? AND user_id = ?')
    .get(id, user.id) as Challenge | undefined;

  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { activity_id, date, status, note } = body;

    if (!activity_id || !date) {
      return new Response(
        JSON.stringify({ error: 'activity_id and date are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validStatus = ['pending', 'completed', 'missed', 'na'].includes(status)
      ? status
      : 'completed';

    const now = new Date().toISOString();

    // Check if record exists
    const existing = db
      .prepare(
        'SELECT * FROM daily_records WHERE challenge_id = ? AND activity_id = ? AND date = ?'
      )
      .get(id, activity_id, date) as DailyRecord | undefined;

    let updatedNote = existing ? existing.note || '' : '';
    if (typeof note === 'string') {
      updatedNote = note.trim();
    }

    if (existing) {
      db.prepare(`
        UPDATE daily_records
        SET status = ?, note = ?, updated_at = ?
        WHERE id = ?
      `).run(validStatus, updatedNote, now, existing.id);
    } else {
      db.prepare(`
        INSERT INTO daily_records (
          id, challenge_id, activity_id, date, status, note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId(),
        id,
        activity_id,
        date,
        validStatus,
        updatedNote,
        now,
        now
      );
    }

    // Recalculate streak and milestones
    const activities = db
      .prepare('SELECT * FROM activities WHERE challenge_id = ? ORDER BY sort_order ASC')
      .all(id) as Activity[];
    const allRecords = db
      .prepare('SELECT * FROM daily_records WHERE challenge_id = ?')
      .all(id) as DailyRecord[];
    const milestones = db
      .prepare('SELECT * FROM milestones WHERE challenge_id = ? ORDER BY target_days ASC')
      .all(id) as Milestone[];

    const analytics = calculateChallengeAnalytics(challenge, activities, allRecords);

    // Check newly reached milestones
    const { newlyReached } = checkMilestones(challenge.id, analytics.currentStreak, milestones);

    if (newlyReached.length > 0) {
      const updateMilestone = db.prepare(`
        UPDATE milestones SET reached = 1, reached_at = ?
        WHERE challenge_id = ? AND target_days = ?
      `);
      for (const target of newlyReached) {
        updateMilestone.run(now, challenge.id, target);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        record: {
          activity_id,
          date,
          status: validStatus,
          note: updatedNote
        },
        currentStreak: analytics.currentStreak,
        longestStreak: analytics.longestStreak,
        totalSuccessfulDays: analytics.totalSuccessfulDays,
        completionPercentage: analytics.completionPercentage,
        newlyReachedMilestones: newlyReached
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Record update error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to update record' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
