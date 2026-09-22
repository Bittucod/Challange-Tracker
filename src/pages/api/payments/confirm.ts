import type { APIRoute } from 'astro';
import { getUserFromCookies } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { verifyAndActivateStakePayment } from '../../../lib/payment';
import type { Challenge, StakeCommitment } from '../../../lib/types';

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
    const { challengeId, providerPaymentId } = body;

    if (!challengeId || !providerPaymentId) {
      return new Response(
        JSON.stringify({ error: 'Missing challengeId or providerPaymentId.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
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

    const result = verifyAndActivateStakePayment(providerPaymentId, challengeId, user.id);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: result.message,
        commitment: result.commitment
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Payment confirm error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Payment confirmation failed.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
