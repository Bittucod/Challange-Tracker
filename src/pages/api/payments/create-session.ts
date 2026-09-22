import type { APIRoute } from 'astro';
import { getUserFromCookies } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { CONFIG, getCurrencyConfig } from '../../../lib/config';
import { createPaymentSession } from '../../../lib/payment';
import type { Challenge } from '../../../lib/types';

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!CONFIG.REAL_MONEY_STAKES_ENABLED) {
    return new Response(
      JSON.stringify({ error: 'Real-money stakes are currently disabled by platform configuration.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { challengeId, amount, currency = CONFIG.defaultCurrency } = body;

    if (!challengeId) {
      return new Response(JSON.stringify({ error: 'Missing challengeId.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const challenge = db
      .prepare('SELECT * FROM challenges WHERE id = ? AND user_id = ?')
      .get(challengeId, user.id) as Challenge | undefined;

    if (!challenge) {
      return new Response(JSON.stringify({ error: 'Challenge not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const currCfg = getCurrencyConfig(currency);
    const stakeAmount = Number(amount);

    if (isNaN(stakeAmount) || stakeAmount < currCfg.minStake || stakeAmount > currCfg.maxStake) {
      return new Response(
        JSON.stringify({
          error: `Stake amount must be between ${currCfg.symbol}${currCfg.minStake} and ${currCfg.symbol}${currCfg.maxStake}.`
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = createPaymentSession({
      challengeId,
      userId: user.id,
      amount: stakeAmount,
      currency: currCfg.code,
      returnUrl: `/app/challenges/${challengeId}`
    });

    return new Response(JSON.stringify({ success: true, ...session }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Create payment session error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to create payment session.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
