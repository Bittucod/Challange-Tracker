import { db } from './db';
import { generateId } from './auth';
import type { Challenge, StakeCommitment, UserBadge } from './types';
import { calculateChallengeAnalytics } from './engine';
import { processRefund, processForfeiture, recordAuditLog } from './payment';

// Check if a challenge is locked by an active stake commitment
export function isChallengeLocked(challengeId: string): boolean {
  const commitment = db
    .prepare('SELECT status FROM stake_commitments WHERE challenge_id = ?')
    .get(challengeId) as { status: string } | undefined;

  if (!commitment) return false;

  const lockedStatuses = ['authorized', 'paid', 'active', 'refundable', 'disputed'];
  return lockedStatuses.includes(commitment.status);
}

// Get active stake commitment for a challenge
export function getChallengeStakeCommitment(challengeId: string): StakeCommitment | null {
  const commitment = db
    .prepare('SELECT * FROM stake_commitments WHERE challenge_id = ?')
    .get(challengeId) as StakeCommitment | undefined;

  return commitment || null;
}

// Award a permanent achievement badge to a user
export function awardUserBadge(
  userId: string,
  challengeId: string,
  badgeKey: string,
  title: string,
  description?: string
): UserBadge {
  const existing = db
    .prepare('SELECT * FROM user_badges WHERE user_id = ? AND badge_key = ? AND challenge_id = ?')
    .get(userId, badgeKey, challengeId) as UserBadge | undefined;

  if (existing) return existing;

  const id = generateId();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO user_badges (id, user_id, challenge_id, badge_key, title, description, awarded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, challengeId, badgeKey, title, description || null, now);

  recordAuditLog(userId, 'BADGE_AWARDED', 'user_badges', id, {
    badgeKey,
    title,
    challengeId
  });

  return {
    id,
    user_id: userId,
    challenge_id: challengeId,
    badge_key: badgeKey,
    title,
    description,
    awarded_at: now
  };
}

// Get all badges for a user
export function getUserBadges(userId: string): UserBadge[] {
  return db
    .prepare('SELECT * FROM user_badges WHERE user_id = ? ORDER BY awarded_at DESC')
    .all(userId) as UserBadge[];
}

// Calculate remaining days until deadline in UTC/timezone
export function getRemainingDays(endDateStr: string): number {
  const todayStr = new Date().toISOString().split('T')[0];
  if (todayStr >= endDateStr) return 0;

  const [tY, tM, tD] = todayStr.split('-').map(Number);
  const [eY, eM, eD] = endDateStr.split('-').map(Number);

  const tDate = new Date(Date.UTC(tY, tM - 1, tD));
  const eDate = new Date(Date.UTC(eY, eM - 1, eD));

  const diffMs = eDate.getTime() - tDate.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// Friendly stake status labels and color classes
export function formatStakeStatus(status?: string): { label: string; badgeClass: string } {
  switch (status) {
    case 'active':
      return { label: 'STAKE COMMITTED', badgeClass: 'badge-stake-active' };
    case 'paid':
      return { label: 'COMMITTED', badgeClass: 'badge-stake-active' };
    case 'refundable':
      return { label: 'ELIGIBLE FOR REFUND', badgeClass: 'badge-stake-success' };
    case 'refunded':
      return { label: 'STAKE RETURNED', badgeClass: 'badge-stake-success' };
    case 'forfeited':
      return { label: 'CHALLENGE ENDED', badgeClass: 'badge-stake-missed' };
    case 'disputed':
      return { label: 'UNDER REVIEW', badgeClass: 'badge-stake-dispute' };
    case 'pending':
      return { label: 'PAYMENT PENDING', badgeClass: 'badge-stake-pending' };
    default:
      return { label: 'FREE CHALLENGE', badgeClass: 'badge-neutral' };
  }
}

// Evaluate challenge completion and trigger automated settlement if due
export function checkAndEvaluateChallengeSettlement(challengeId: string) {
  const challenge = db
    .prepare('SELECT * FROM challenges WHERE id = ?')
    .get(challengeId) as Challenge | undefined;

  if (!challenge || challenge.challenge_type !== 'stake') return null;

  const commitment = getChallengeStakeCommitment(challengeId);
  if (!commitment || commitment.status !== 'active') return null;

  const remainingDays = getRemainingDays(challenge.end_date);
  const todayStr = new Date().toISOString().split('T')[0];

  // If still ongoing, check if already mathematically failed or completed
  const activities = db
    .prepare('SELECT * FROM activities WHERE challenge_id = ? ORDER BY sort_order ASC')
    .all(challengeId) as any[];

  const records = db
    .prepare('SELECT * FROM daily_records WHERE challenge_id = ?')
    .all(challengeId) as any[];

  const analytics = calculateChallengeAnalytics(challenge, activities, records);

  // Check milestone badges during active challenge
  if (analytics.currentStreak >= 7) {
    awardUserBadge(challenge.user_id, challengeId, '7_day_streak', '7 Day Streak 🔥', 'Maintained consistency for 7 days');
  }
  if (analytics.currentStreak >= 30) {
    awardUserBadge(challenge.user_id, challengeId, '30_day_streak', '30 Day Streak ⚡', 'Maintained consistency for 30 days');
  }
  if (analytics.currentStreak >= 50) {
    awardUserBadge(challenge.user_id, challengeId, '50_day_streak', '50 Day Streak 🏆', 'Halfway to 100 days');
  }

  // If deadline has passed
  if (todayStr > challenge.end_date) {
    // Challenge has concluded. Determine success.
    // Consistency criteria:
    // For 100 days, success rule applies. Let's see if totalSuccessfulDays >= required days.
    // Standard rule: completionPercentage >= 80% or totalSuccessfulDays >= duration - 5
    const isSuccess = analytics.totalSuccessfulDays >= Math.floor(challenge.duration * 0.8);

    if (isSuccess) {
      // Award permanent completion badge
      awardUserBadge(
        challenge.user_id,
        challengeId,
        'challenge_completed',
        `${challenge.duration} DAY SHIPPER 🌟`,
        `Successfully completed the ${challenge.name} stake challenge with ${analytics.totalSuccessfulDays} successful days.`
      );

      // Process refund
      processRefund(challengeId, `Successfully completed challenge with ${analytics.completionPercentage}% consistency`);
    } else {
      // Process forfeiture
      processForfeiture(
        challengeId,
        `Challenge ended with ${analytics.totalSuccessfulDays} of ${challenge.duration} successful days.`
      );
    }
  }

  return {
    remainingDays,
    totalSuccessfulDays: analytics.totalSuccessfulDays,
    completionPercentage: analytics.completionPercentage
  };
}
