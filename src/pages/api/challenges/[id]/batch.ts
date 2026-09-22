import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db';
import { getUserFromCookies, generateId } from '../../../../lib/auth';
import { calculateChallengeAnalytics, checkMilestones, getLocalTodayDateString } from '../../../../lib/engine';
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
    const { records = [] } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return new Response(JSON.stringify({ success: true, updatedCount: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const todayStr = getLocalTodayDateString();
    const now = new Date().toISOString();

    const upsertRecord = db.transaction((recs: any[]) => {
      for (const item of recs) {
        if (!item.activity_id || !item.date) continue;

        const note = typeof item.note === 'string' ? item.note.trim() : '';

        const existing = db
          .prepare(
            'SELECT id, status FROM daily_records WHERE challenge_id = ? AND activity_id = ? AND date = ?'
          )
          .get(id, item.activity_id, item.date) as { id: string; status: string } | undefined;

        // If date is not today, status cannot be changed
        let statusToSave = existing ? existing.status : 'pending';
        if (item.date === todayStr) {
          statusToSave = ['pending', 'completed', 'missed', 'na'].includes(item.status)
            ? item.status
            : (existing ? existing.status : 'completed');
        }

        if (existing) {
          db.prepare(`
            UPDATE daily_records
            SET status = ?, note = ?, updated_at = ?
            WHERE id = ?
          `).run(statusToSave, note, now, existing.id);
        } else {
          db.prepare(`
            INSERT INTO daily_records (
              id, challenge_id, activity_id, date, status, note, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            generateId(),
            id,
            item.activity_id,
            item.date,
            statusToSave,
            note,
            now,
            now
          );
        }
      }
    });

    upsertRecord(records);

    // Recalculate stats
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
        updatedCount: records.length,
        analytics,
        newlyReachedMilestones: newlyReached
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Batch sync error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to process batch sync' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
