import crypto from 'node:crypto';
import { db } from './db';
import { generateId } from './auth';
import type { StakeCommitment, Transaction, StakeStatus } from './types';
import { CONFIG } from './config';

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'streakgrid_dev_webhook_secret_key_2026';

export interface PaymentSessionOptions {
  challengeId: string;
  userId: string;
  amount: number;
  currency: string;
  returnUrl: string;
}

export interface PaymentSessionResult {
  sessionId: string;
  providerPaymentId: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
}

export interface WebhookEventPayload {
  eventId: string;
  eventType: 'payment.authorized' | 'payment.succeeded' | 'payment.failed' | 'refund.succeeded';
  providerPaymentId: string;
  challengeId: string;
  userId: string;
  amount: number;
  currency: string;
  timestamp: string;
}

// Generate HMAC-SHA256 signature for webhook verification
export function signWebhookPayload(payloadString: string): string {
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payloadString)
    .digest('hex');
}

// Verify webhook signature
export function verifyWebhookSignature(payloadString: string, signature: string): boolean {
  try {
    const expected = signWebhookPayload(payloadString);
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (signatureBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// Record an immutable transaction in the financial ledger
export function recordLedgerTransaction(
  userId: string,
  challengeId: string,
  type: 'deposit' | 'refund' | 'fee' | 'forfeiture',
  amount: number,
  currency: string,
  status: 'pending' | 'completed' | 'failed',
  providerReference?: string
): Transaction {
  const id = generateId();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO transactions (
      id, user_id, challenge_id, type, amount, currency, status, provider_reference, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId, challengeId, type, amount, currency, status, providerReference || null, now);

  return {
    id,
    user_id: userId,
    challenge_id: challengeId,
    type,
    amount,
    currency,
    status,
    provider_reference: providerReference,
    created_at: now
  };
}

// Record an audit log entry
export function recordAuditLog(
  actorId: string | undefined,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, any> = {}
) {
  const id = generateId();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, actorId || null, action, entityType, entityId, JSON.stringify(metadata), now);
}

// Initialize payment session
export function createPaymentSession(options: PaymentSessionOptions): PaymentSessionResult {
  const { challengeId, userId, amount, currency, returnUrl } = options;

  if (amount < 10) {
    throw new Error('Invalid stake amount.');
  }

  const providerPaymentId = `pay_${crypto.randomBytes(12).toString('hex')}`;
  const sessionId = `sess_${crypto.randomBytes(16).toString('hex')}`;
  const now = new Date().toISOString();

  // Check if a commitment already exists for this challenge
  const existing = db
    .prepare('SELECT * FROM stake_commitments WHERE challenge_id = ?')
    .get(challengeId) as StakeCommitment | undefined;

  if (existing) {
    if (['paid', 'active'].includes(existing.status)) {
      throw new Error('This challenge already has an active stake commitment.');
    }
    // Update existing pending commitment
    db.prepare(`
      UPDATE stake_commitments
      SET amount = ?, currency = ?, status = 'pending', provider_payment_id = ?, created_at = ?
      WHERE id = ?
    `).run(amount, currency, providerPaymentId, now, existing.id);
  } else {
    // Insert new stake commitment in pending status
    const commitmentId = generateId();
    db.prepare(`
      INSERT INTO stake_commitments (
        id, challenge_id, user_id, amount, currency, status, payment_provider,
        provider_payment_id, platform_fee, created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', 'mock_escrow', ?, 0, ?)
    `).run(commitmentId, challengeId, userId, amount, currency, providerPaymentId, now);
  }

  const checkoutUrl = `/app/challenges/${challengeId}/checkout?session_id=${sessionId}&provider_payment_id=${providerPaymentId}`;

  return {
    sessionId,
    providerPaymentId,
    checkoutUrl,
    amount,
    currency
  };
}

// Server-side verification and activation of payment (called by webhook or secure verification flow)
export function verifyAndActivateStakePayment(
  providerPaymentId: string,
  challengeId: string,
  actorUserId?: string
): { success: boolean; message: string; commitment?: StakeCommitment } {
  const commitment = db
    .prepare('SELECT * FROM stake_commitments WHERE challenge_id = ? AND provider_payment_id = ?')
    .get(challengeId, providerPaymentId) as StakeCommitment | undefined;

  if (!commitment) {
    return { success: false, message: 'Commitment not found.' };
  }

  // Idempotency guard: already active or paid
  if (['paid', 'active'].includes(commitment.status)) {
    return { success: true, message: 'Payment already verified and active.', commitment };
  }

  const now = new Date().toISOString();

  // Atomic database transaction
  const activateTx = db.transaction(() => {
    // 1. Update commitment status to active
    db.prepare(`
      UPDATE stake_commitments
      SET status = 'active', activated_at = ?
      WHERE id = ?
    `).run(now, commitment.id);

    // 2. Update challenge type and settlement status
    db.prepare(`
      UPDATE challenges
      SET challenge_type = 'stake', settlement_status = 'unsettled', updated_at = ?
      WHERE id = ?
    `).run(now, challengeId);

    // 3. Record transaction in ledger
    recordLedgerTransaction(
      commitment.user_id,
      challengeId,
      'deposit',
      commitment.amount,
      commitment.currency,
      'completed',
      providerPaymentId
    );

    // 4. Record audit log
    recordAuditLog(actorUserId || commitment.user_id, 'STAKE_ACTIVATED', 'stake_commitments', commitment.id, {
      challengeId,
      amount: commitment.amount,
      currency: commitment.currency,
      providerPaymentId
    });

    // 5. In-app notification
    const notifId = generateId();
    const challengeRow = db.prepare('SELECT name FROM challenges WHERE id = ?').get(challengeId) as { name: string } | undefined;
    const challengeTitle = challengeRow?.name || 'Your Challenge';
    const currSymbol = commitment.currency === 'USD' ? '$' : commitment.currency === 'EUR' ? '€' : commitment.currency === 'GBP' ? '£' : '₹';
    const notifTitle = '🛡️ Stake Commitment Secured in Escrow';
    const notifMsg = `Your commitment of ${currSymbol}${commitment.amount.toLocaleString()} for "${challengeTitle}" is secured in escrow. Challenge officially started! Complete all locked criteria to claim 100% of your stake back.`;

    db.prepare(`
      INSERT INTO notifications (id, user_id, challenge_id, type, title, message, is_read, created_at)
      VALUES (?, ?, ?, 'stake_activated', ?, ?, 0, ?)
    `).run(notifId, commitment.user_id, challengeId, notifTitle, notifMsg, now);
  });

  activateTx();

  const updated = db
    .prepare('SELECT * FROM stake_commitments WHERE id = ?')
    .get(commitment.id) as StakeCommitment;

  return { success: true, message: 'Stake payment successfully verified.', commitment: updated };
}

// Process a refund upon challenge completion
export function processRefund(
  challengeId: string,
  reason: string = 'Challenge completed successfully',
  adminActorId?: string
): { success: boolean; message: string; refundReference?: string } {
  if (!CONFIG.REFUNDS_ENABLED) {
    return { success: false, message: 'Refunds are currently disabled by platform config.' };
  }

  const commitment = db
    .prepare('SELECT * FROM stake_commitments WHERE challenge_id = ?')
    .get(challengeId) as StakeCommitment | undefined;

  if (!commitment) {
    return { success: false, message: 'No commitment found for this challenge.' };
  }

  if (commitment.status === 'refunded') {
    return { success: true, message: 'Stake has already been refunded.' };
  }

  if (!['active', 'refundable', 'paid'].includes(commitment.status)) {
    return { success: false, message: `Cannot refund commitment with status "${commitment.status}".` };
  }

  const now = new Date().toISOString();
  const refundRef = `ref_${crypto.randomBytes(10).toString('hex')}`;

  const refundTx = db.transaction(() => {
    // 1. Update commitment
    db.prepare(`
      UPDATE stake_commitments
      SET status = 'refunded', settled_at = ?
      WHERE id = ?
    `).run(now, commitment.id);

    // 2. Update challenge settlement status
    db.prepare(`
      UPDATE challenges
      SET settlement_status = 'refunded', updated_at = ?
      WHERE id = ?
    `).run(now, challengeId);

    // 3. Ledger transaction
    recordLedgerTransaction(
      commitment.user_id,
      challengeId,
      'refund',
      commitment.amount,
      commitment.currency,
      'completed',
      refundRef
    );

    // 4. Audit log
    recordAuditLog(adminActorId || commitment.user_id, 'STAKE_REFUNDED', 'stake_commitments', commitment.id, {
      challengeId,
      amount: commitment.amount,
      currency: commitment.currency,
      refundRef,
      reason
    });
  });

  refundTx();

  return { success: true, message: 'Stake refund processed successfully.', refundReference: refundRef };
}

// Process forfeiture upon challenge failure
export function processForfeiture(
  challengeId: string,
  reason: string = 'Challenge ended without meeting success criteria',
  adminActorId?: string
): { success: boolean; message: string } {
  const commitment = db
    .prepare('SELECT * FROM stake_commitments WHERE challenge_id = ?')
    .get(challengeId) as StakeCommitment | undefined;

  if (!commitment) {
    return { success: false, message: 'No commitment found for this challenge.' };
  }

  if (['forfeited', 'refunded'].includes(commitment.status)) {
    return { success: false, message: `Commitment is already settled as "${commitment.status}".` };
  }

  const now = new Date().toISOString();
  const forfeitRef = `forfeit_${crypto.randomBytes(10).toString('hex')}`;

  const forfeitTx = db.transaction(() => {
    // 1. Update commitment
    db.prepare(`
      UPDATE stake_commitments
      SET status = 'forfeited', settled_at = ?
      WHERE id = ?
    `).run(now, commitment.id);

    // 2. Update challenge settlement status
    db.prepare(`
      UPDATE challenges
      SET settlement_status = 'forfeited', updated_at = ?
      WHERE id = ?
    `).run(now, challengeId);

    // 3. Record in ledger as forfeiture
    recordLedgerTransaction(
      commitment.user_id,
      challengeId,
      'forfeiture',
      commitment.amount,
      commitment.currency,
      'completed',
      forfeitRef
    );

    // 4. Audit log
    recordAuditLog(adminActorId || commitment.user_id, 'STAKE_FORFEITED', 'stake_commitments', commitment.id, {
      challengeId,
      amount: commitment.amount,
      currency: commitment.currency,
      forfeitRef,
      reason
    });
  });

  forfeitTx();

  return { success: true, message: 'Stake forfeiture recorded according to terms.' };
}
