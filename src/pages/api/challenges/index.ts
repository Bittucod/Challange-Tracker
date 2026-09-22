import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { getUserFromCookies, generateId } from '../../../lib/auth';
import { calculateEndDate, DEFAULT_MILESTONE_TARGETS } from '../../../lib/engine';
import { CONFIG, getCurrencyConfig } from '../../../lib/config';
import { createPaymentSession } from '../../../lib/payment';
import type { Challenge, Activity } from '../../../lib/types';

export const GET: APIRoute = async ({ cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const challenges = db
    .prepare(
      'SELECT * FROM challenges WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC'
    )
    .all(user.id) as Challenge[];

  return new Response(JSON.stringify({ challenges }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const {
      name,
      description = '',
      start_date,
      duration = 100,
      success_rule = 'all',
      success_min_count = 1,
      activities = [],
      challenge_type = 'free',
      stake_amount,
      stake_currency = CONFIG.defaultCurrency,
      visibility = 'private',
      timezone = 'UTC'
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Challenge name is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const dur = parseInt(String(duration), 10);
    if (isNaN(dur) || dur < 1 || dur > 1000) {
      return new Response(
        JSON.stringify({ error: 'Duration must be between 1 and 1000 days.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Default start date to today if not provided or invalid
    const validStartDate =
      typeof start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start_date)
        ? start_date
        : new Date().toISOString().split('T')[0];

    const endDate = calculateEndDate(validStartDate, dur);
    const challengeId = generateId();
    const now = new Date().toISOString();

    const isStake = challenge_type === 'stake';
    let validatedStakeAmount = 0;
    let validatedCurrency = stake_currency;

    if (isStake) {
      if (!CONFIG.REAL_MONEY_STAKES_ENABLED) {
        return new Response(
          JSON.stringify({ error: 'Real-money stakes are currently disabled by platform config.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const currCfg = getCurrencyConfig(stake_currency);
      validatedCurrency = currCfg.code;
      validatedStakeAmount = Number(stake_amount);

      if (isNaN(validatedStakeAmount) || validatedStakeAmount < currCfg.minStake || validatedStakeAmount > currCfg.maxStake) {
        return new Response(
          JSON.stringify({
            error: `Stake amount must be between ${currCfg.symbol}${currCfg.minStake} and ${currCfg.symbol}${currCfg.maxStake}.`
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const validVisibility = ['private', 'community', 'public'].includes(visibility)
      ? visibility
      : 'private';

    const insertChallenge = db.prepare(`
      INSERT INTO challenges (
        id, user_id, name, description, start_date, duration, end_date,
        success_rule, success_min_count, challenge_type, visibility, timezone,
        settlement_status, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const insertActivity = db.prepare(`
      INSERT INTO activities (
        id, challenge_id, name, icon, sort_order, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?)
    `);

    const insertMilestone = db.prepare(`
      INSERT INTO milestones (
        id, challenge_id, target_days, reached, reached_at
      ) VALUES (?, ?, ?, 0, NULL)
    `);

    // Use transaction for atomic insertion
    const createTx = db.transaction(() => {
      insertChallenge.run(
        challengeId,
        user.id,
        name.trim(),
        description.trim(),
        validStartDate,
        dur,
        endDate,
        ['all', 'at_least_one', 'custom_min'].includes(success_rule)
          ? success_rule
          : 'all',
        Math.max(1, parseInt(String(success_min_count), 10) || 1),
        isStake ? 'stake' : 'free',
        validVisibility,
        timezone || 'UTC',
        isStake ? 'unsettled' : 'unsettled',
        now,
        now
      );

      // Add activities
      const validActivities: Array<{ name: string; icon: string }> = Array.isArray(activities) && activities.length > 0
        ? activities
        : [
            { name: 'X', icon: 'x' },
            { name: 'LinkedIn', icon: 'linkedin' },
            { name: 'YouTube', icon: 'youtube' },
            { name: 'Reddit', icon: 'reddit' },
            { name: 'Instagram', icon: 'instagram' }
          ];

      validActivities.forEach((act, idx) => {
        const actName = typeof act === 'string' ? act : act.name || `Activity ${idx + 1}`;
        const actIcon = typeof act === 'object' && act.icon ? act.icon : 'target';
        insertActivity.run(
          generateId(),
          challengeId,
          actName.trim(),
          actIcon,
          idx,
          now
        );
      });

      // Add milestones up to duration
      for (const target of DEFAULT_MILESTONE_TARGETS) {
        if (target <= dur) {
          insertMilestone.run(generateId(), challengeId, target);
        }
      }
      if (!DEFAULT_MILESTONE_TARGETS.includes(dur) && dur > 1) {
        insertMilestone.run(generateId(), challengeId, dur);
      }
    });

    createTx();

    let checkoutSession = null;
    if (isStake) {
      checkoutSession = createPaymentSession({
        challengeId,
        userId: user.id,
        amount: validatedStakeAmount,
        currency: validatedCurrency,
        returnUrl: `/app/challenges/${challengeId}`
      });
    }

    const createdChallenge = db
      .prepare('SELECT * FROM challenges WHERE id = ?')
      .get(challengeId) as Challenge;
    const createdActivities = db
      .prepare('SELECT * FROM activities WHERE challenge_id = ? ORDER BY sort_order ASC')
      .all(challengeId) as Activity[];

    return new Response(
      JSON.stringify({
        success: true,
        challenge: createdChallenge,
        activities: createdActivities,
        isStake,
        checkoutUrl: checkoutSession?.checkoutUrl || null
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Challenge creation error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to create challenge.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
