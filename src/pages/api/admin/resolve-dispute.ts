import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { getUserFromCookies } from '../../../lib/auth';
import { CONFIG } from '../../../lib/config';
import { processRefund, processForfeiture, recordAuditLog } from '../../../lib/payment';
import type { Dispute } from '../../../lib/types';

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Admin access check
  const isAdmin = Boolean(user.is_admin) || CONFIG.adminEmails.includes(user.email.toLowerCase());
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden: Admin access required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { disputeId, action, resolutionNote = '' } = body;

    if (!disputeId || !['uphold', 'reverse_refund'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid dispute resolution request.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const dispute = db
      .prepare('SELECT * FROM disputes WHERE id = ?')
      .get(disputeId) as Dispute | undefined;

    if (!dispute) {
      return new Response(JSON.stringify({ error: 'Dispute not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = new Date().toISOString();

    if (action === 'reverse_refund') {
      // Admin ruled in favor of user -> refund stake
      processRefund(
        dispute.challenge_id,
        `Dispute resolved in favor of user: ${resolutionNote || 'Verified proof approved'}`,
        user.id
      );

      db.prepare(`
        UPDATE disputes
        SET status = 'reversed', resolution_note = ?, resolved_by = ?, resolved_at = ?
        WHERE id = ?
      `).run(resolutionNote || 'Refund approved after administrative review.', user.id, now, disputeId);
    } else {
      // Admin upheld original challenge result
      processForfeiture(
        dispute.challenge_id,
        `Dispute upheld by administrator: ${resolutionNote || 'Challenge requirements not met'}`,
        user.id
      );

      db.prepare(`
        UPDATE disputes
        SET status = 'upheld', resolution_note = ?, resolved_by = ?, resolved_at = ?
        WHERE id = ?
      `).run(resolutionNote || 'Original outcome upheld after administrative review.', user.id, now, disputeId);
    }

    recordAuditLog(user.id, 'DISPUTE_RESOLVED', 'disputes', disputeId, {
      challengeId: dispute.challenge_id,
      action,
      resolutionNote
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Dispute marked as ${action === 'reverse_refund' ? 'reversed & refunded' : 'upheld'}.`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Admin resolve dispute error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to resolve dispute.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
