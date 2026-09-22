import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db';
import { getUserFromCookies, generateId } from '../../../../lib/auth';
import { recordAuditLog } from '../../../../lib/payment';
import type { Challenge, Dispute, StakeCommitment } from '../../../../lib/types';

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
    .get(id, user.id) as Challenge | undefined;

  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const evidence_url = typeof body.evidence_url === 'string' ? body.evidence_url.trim() : '';

    if (!reason || reason.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Please provide a clear reason for the dispute (at least 10 characters).' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if open dispute already exists
    const existing = db
      .prepare("SELECT * FROM disputes WHERE challenge_id = ? AND status = 'under_review'")
      .get(id) as Dispute | undefined;

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'A dispute is already under review for this challenge.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const disputeId = generateId();
    const now = new Date().toISOString();

    const disputeTx = db.transaction(() => {
      // 1. Insert dispute
      db.prepare(`
        INSERT INTO disputes (id, challenge_id, user_id, reason, evidence_url, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'under_review', ?)
      `).run(disputeId, id, user.id, reason, evidence_url || null, now);

      // 2. Mark commitment and challenge as disputed
      db.prepare(`
        UPDATE stake_commitments SET status = 'disputed' WHERE challenge_id = ?
      `).run(id);

      db.prepare(`
        UPDATE challenges SET settlement_status = 'disputed', updated_at = ? WHERE id = ?
      `).run(now, id);

      // 3. Audit log
      recordAuditLog(user.id, 'DISPUTE_FILED', 'disputes', disputeId, {
        challengeId: id,
        reason,
        evidence_url
      });
    });

    disputeTx();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Dispute submitted successfully. Our team will review your evidence under published challenge rules.',
        disputeId
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Dispute submission error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to submit dispute.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
