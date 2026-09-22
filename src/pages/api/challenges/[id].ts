import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { getUserFromCookies } from '../../../lib/auth';
import { calculateChallengeAnalytics } from '../../../lib/engine';
import { isChallengeLocked, getChallengeStakeCommitment } from '../../../lib/stakes';
import type { Challenge, Activity, DailyRecord, Milestone } from '../../../lib/types';

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

  const challenge = db
    .prepare('SELECT * FROM challenges WHERE id = ? AND user_id = ?')
    .get(id, user.id) as Challenge | undefined;

  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const activities = db
    .prepare('SELECT * FROM activities WHERE challenge_id = ? ORDER BY sort_order ASC')
    .all(id) as Activity[];

  const records = db
    .prepare('SELECT * FROM daily_records WHERE challenge_id = ?')
    .all(id) as DailyRecord[];

  const milestones = db
    .prepare('SELECT * FROM milestones WHERE challenge_id = ? ORDER BY target_days ASC')
    .all(id) as Milestone[];

  const analytics = calculateChallengeAnalytics(challenge, activities, records);
  const commitment = getChallengeStakeCommitment(id);
  const isLocked = isChallengeLocked(id);

  return new Response(
    JSON.stringify({
      challenge,
      activities,
      records,
      milestones,
      analytics,
      commitment,
      isLocked
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
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
    .get(id, user.id) as Challenge | undefined;

  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const locked = isChallengeLocked(id);

  try {
    const body = await request.json();
    const {
      name,
      description,
      success_rule,
      success_min_count,
      visibility,
      allow_comments,
      show_stake_amount,
      proof_note,
      proof_url
    } = body;

    // Commitment Lock Rule: cannot soften or modify success criteria of active stake challenge
    if (locked) {
      if (
        (success_rule && success_rule !== challenge.success_rule) ||
        (success_min_count !== undefined && success_min_count !== challenge.success_min_count)
      ) {
        return new Response(
          JSON.stringify({
            error:
              'Success criteria are locked because this challenge has an active stake commitment. Criteria cannot be modified mid-challenge.'
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const newName = typeof name === 'string' && name.trim() ? name.trim() : challenge.name;
    const newDesc = typeof description === 'string' ? description.trim() : challenge.description;
    const newRule = !locked && ['all', 'at_least_one', 'custom_min'].includes(success_rule)
      ? success_rule
      : challenge.success_rule;
    const newMin =
      !locked && typeof success_min_count === 'number' && success_min_count >= 1
        ? success_min_count
        : challenge.success_min_count;

    const newVisibility = ['private', 'community', 'public'].includes(visibility)
      ? visibility
      : challenge.visibility || 'private';

    const newAllowComments = allow_comments !== undefined ? (allow_comments ? 1 : 0) : (challenge.allow_comments ?? 1);
    const newShowStake = show_stake_amount !== undefined ? (show_stake_amount ? 1 : 0) : (challenge.show_stake_amount ?? 1);
    const newProofNote = proof_note !== undefined ? String(proof_note).trim() : challenge.proof_note;
    const newProofUrl = proof_url !== undefined ? String(proof_url).trim() : challenge.proof_url;

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE challenges
      SET name = ?, description = ?, success_rule = ?, success_min_count = ?,
          visibility = ?, allow_comments = ?, show_stake_amount = ?,
          proof_note = ?, proof_url = ?, updated_at = ?
      WHERE id = ?
    `).run(
      newName,
      newDesc,
      newRule,
      newMin,
      newVisibility,
      newAllowComments,
      newShowStake,
      newProofNote,
      newProofUrl,
      now,
      id
    );

    const updated = db.prepare('SELECT * FROM challenges WHERE id = ?').get(id);

    return new Response(JSON.stringify({ success: true, challenge: updated, isLocked: locked }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Update challenge error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to update challenge' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
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
    .get(id, user.id) as Challenge | undefined;

  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Commitment Lock Rule: Cannot delete active stake challenge!
  if (isChallengeLocked(id)) {
    return new Response(
      JSON.stringify({
        error:
          'This challenge is backed by an active stake commitment. Active stake challenges cannot be deleted to protect commitment integrity.'
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  db.prepare('DELETE FROM challenges WHERE id = ?').run(id);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
