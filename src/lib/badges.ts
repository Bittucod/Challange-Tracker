import { db } from './db';
import { generateId } from './auth';
import type { Challenge, Activity, DailyRecord, UserBadge } from './types';
import { calculateChallengeAnalytics } from './engine';

export interface BadgeDefinition {
  key: string;
  title: string;
  description: string;
  category: 'Streaks' | 'Challenges' | 'Stakes' | 'Habits' | 'Community';
  target: number;
  unit: string;
  iconType: string;
}

export interface EvaluatedBadge extends BadgeDefinition {
  isUnlocked: boolean;
  awardedAt?: string;
  formattedAwardedDate?: string;
  currentProgress: number;
  progressPercent: number;
  progressText: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // 1. STREAKS
  {
    key: 'first_step',
    title: 'First Step',
    description: 'Log your very first daily completed checkmark',
    category: 'Streaks',
    target: 1,
    unit: 'log',
    iconType: 'first_step'
  },
  {
    key: 'streak_3',
    title: '3-Day Ignition',
    description: 'Build an active 3-day consistency streak',
    category: 'Streaks',
    target: 3,
    unit: 'days',
    iconType: 'streak_3'
  },
  {
    key: 'streak_7',
    title: 'Week Warrior',
    description: 'Maintain an unbroken 7-day consistency streak',
    category: 'Streaks',
    target: 7,
    unit: 'days',
    iconType: 'streak_7'
  },
  {
    key: 'streak_14',
    title: 'Fortnight Focus',
    description: 'Build a formidable 14-day momentum streak',
    category: 'Streaks',
    target: 14,
    unit: 'days',
    iconType: 'streak_14'
  },
  {
    key: 'streak_30',
    title: 'Monthly Titan',
    description: 'Conquer the 30-day streak milestone',
    category: 'Streaks',
    target: 30,
    unit: 'days',
    iconType: 'streak_30'
  },
  {
    key: 'streak_50',
    title: 'Half Century',
    description: 'Reach a powerhouse 50-day streak milestone',
    category: 'Streaks',
    target: 50,
    unit: 'days',
    iconType: 'streak_50'
  },
  {
    key: 'streak_100',
    title: 'Century Legend',
    description: 'Achieve the pinnacle 100-day consistency streak',
    category: 'Streaks',
    target: 100,
    unit: 'days',
    iconType: 'streak_100'
  },

  // 2. CHALLENGES
  {
    key: 'challenge_pioneer',
    title: 'Challenge Pioneer',
    description: 'Create and launch your first challenge',
    category: 'Challenges',
    target: 1,
    unit: 'challenge',
    iconType: 'challenge_pioneer'
  },
  {
    key: 'triple_threat',
    title: 'Triple Threat',
    description: 'Create and manage 3 distinct challenges',
    category: 'Challenges',
    target: 3,
    unit: 'challenges',
    iconType: 'triple_threat'
  },
  {
    key: 'challenge_finisher',
    title: 'Challenge Finisher',
    description: 'Complete an entire challenge to the final day',
    category: 'Challenges',
    target: 1,
    unit: 'completed',
    iconType: 'challenge_finisher'
  },
  {
    key: 'multi_track',
    title: 'Multi-Track Master',
    description: 'Track 3 or more daily activities in one challenge',
    category: 'Challenges',
    target: 3,
    unit: 'activities',
    iconType: 'multi_track'
  },

  // 3. STAKES
  {
    key: 'skin_in_the_game',
    title: 'Skin in the Game',
    description: 'Back a challenge with a real accountability stake',
    category: 'Stakes',
    target: 1,
    unit: 'stake',
    iconType: 'skin_in_the_game'
  },
  {
    key: 'high_stakes',
    title: 'High Stakes',
    description: 'Put $100 or ₹5,000+ on the line for your goal',
    category: 'Stakes',
    target: 100,
    unit: 'USD stake',
    iconType: 'high_stakes'
  },
  {
    key: 'escrow_victor',
    title: 'Escrow Victor',
    description: 'Complete your challenge and reclaim your stake in full',
    category: 'Stakes',
    target: 1,
    unit: 'refunded',
    iconType: 'escrow_victor'
  },

  // 4. HABITS & NOTES
  {
    key: 'note_taker',
    title: 'Note Taker',
    description: 'Attach your first private hidden daily cell note',
    category: 'Habits',
    target: 1,
    unit: 'note',
    iconType: 'note_taker'
  },
  {
    key: 'daily_chronicler',
    title: 'Daily Chronicler',
    description: 'Document your journey with 10 daily cell notes',
    category: 'Habits',
    target: 10,
    unit: 'notes',
    iconType: 'daily_chronicler'
  },
  {
    key: 'fifty_checks',
    title: 'Fifty Checks',
    description: 'Accumulate 50 total completed activity checkmarks',
    category: 'Habits',
    target: 50,
    unit: 'checkmarks',
    iconType: 'fifty_checks'
  },
  {
    key: 'centurion_logger',
    title: 'Centurion Logger',
    description: 'Log 100 total completed activity checkmarks',
    category: 'Habits',
    target: 100,
    unit: 'checkmarks',
    iconType: 'centurion_logger'
  },

  // 5. COMMUNITY
  {
    key: 'proof_of_work',
    title: 'Proof of Work',
    description: 'Add public proof URL or final build note to a challenge',
    category: 'Community',
    target: 1,
    unit: 'proof',
    iconType: 'proof_of_work'
  },
  {
    key: 'community_cheer',
    title: 'Community Cheer',
    description: 'Cheer on peers with 3 encouragement comments or reactions',
    category: 'Community',
    target: 3,
    unit: 'cheers',
    iconType: 'community_cheer'
  }
];

export function evaluateAndSyncUserBadges(userId: string): EvaluatedBadge[] {
  // 1. Fetch user's existing badges from user_badges table
  const existingBadges = db
    .prepare('SELECT * FROM user_badges WHERE user_id = ?')
    .all(userId) as UserBadge[];
  const existingMap = new Map<string, UserBadge>();
  for (const b of existingBadges) {
    existingMap.set(b.badge_key, b);
  }

  // 2. Fetch user's challenges
  const challenges = db
    .prepare('SELECT * FROM challenges WHERE user_id = ? AND is_archived = 0')
    .all(userId) as Challenge[];

  // 3. Compute stats across all challenges
  let maxStreak = 0;
  let maxActivitiesCount = 0;
  let finishedChallengesCount = 0;
  let proofSubmittedCount = 0;

  for (const c of challenges) {
    const acts = db
      .prepare('SELECT * FROM activities WHERE challenge_id = ? ORDER BY sort_order ASC')
      .all(c.id) as Activity[];
    const recs = db
      .prepare('SELECT * FROM daily_records WHERE challenge_id = ?')
      .all(c.id) as DailyRecord[];

    const analytics = calculateChallengeAnalytics(c, acts, recs);
    if (analytics.currentStreak > maxStreak) maxStreak = analytics.currentStreak;
    if (analytics.longestStreak > maxStreak) maxStreak = analytics.longestStreak;

    const activeActs = acts.filter((a) => a.is_active);
    if (activeActs.length > maxActivitiesCount) maxActivitiesCount = activeActs.length;

    // Check if finished
    const isFinished =
      c.settlement_status === 'refunded' ||
      (analytics.days.every((d) => !d.isFuture) && analytics.completionPercentage >= 70);
    if (isFinished) finishedChallengesCount++;

    if (Boolean(c.proof_url && c.proof_url.trim()) || Boolean(c.proof_note && c.proof_note.trim())) {
      proofSubmittedCount++;
    }
  }

  // 4. Total completed checkmarks & notes
  const totalCompletedChecks = (
    db
      .prepare(`
        SELECT COUNT(*) as count FROM daily_records dr
        JOIN challenges c ON dr.challenge_id = c.id
        WHERE c.user_id = ? AND dr.status = 'completed'
      `)
      .get(userId) as { count: number }
  ).count;

  const totalNotesCount = (
    db
      .prepare(`
        SELECT COUNT(*) as count FROM daily_records dr
        JOIN challenges c ON dr.challenge_id = c.id
        WHERE c.user_id = ? AND dr.note IS NOT NULL AND TRIM(dr.note) != ''
      `)
      .get(userId) as { count: number }
  ).count;

  // 5. Stakes stats
  const stakes = db
    .prepare('SELECT * FROM stake_commitments WHERE user_id = ?')
    .all(userId) as Array<{ amount: number; currency: string; status: string }>;

  const activeOrPaidStakes = stakes.filter((s) =>
    ['active', 'paid', 'refundable', 'refunded'].includes(s.status)
  );
  const stakeCount = activeOrPaidStakes.length;

  let maxStakeUSD = 0;
  for (const s of activeOrPaidStakes) {
    // Normalise INR to USD equivalent approx 1:85
    const amtUSD = s.currency === 'INR' ? Math.round(s.amount / 85) : s.amount;
    if (amtUSD > maxStakeUSD) maxStakeUSD = amtUSD;
  }

  const refundedStakesCount = stakes.filter((s) => s.status === 'refunded').length;

  // 6. Community comments & reactions given
  const commentsGiven = (
    db.prepare('SELECT COUNT(*) as count FROM comments WHERE user_id = ?').get(userId) as { count: number }
  ).count;
  const reactionsGiven = (
    db.prepare('SELECT COUNT(*) as count FROM reactions WHERE user_id = ?').get(userId) as { count: number }
  ).count;
  const totalCheers = commentsGiven + reactionsGiven;

  // 7. Evaluate each badge definition
  const now = new Date().toISOString();
  const insertBadgeStmt = db.prepare(`
    INSERT INTO user_badges (id, user_id, challenge_id, badge_key, title, description, awarded_at)
    VALUES (?, ?, NULL, ?, ?, ?, ?)
  `);

  const results: EvaluatedBadge[] = [];

  for (const def of BADGE_DEFINITIONS) {
    let progress = 0;

    switch (def.key) {
      case 'first_step':
        progress = totalCompletedChecks;
        break;
      case 'streak_3':
      case 'streak_7':
      case 'streak_14':
      case 'streak_30':
      case 'streak_50':
      case 'streak_100':
        progress = maxStreak;
        break;
      case 'challenge_pioneer':
      case 'triple_threat':
        progress = challenges.length;
        break;
      case 'challenge_finisher':
        progress = finishedChallengesCount;
        break;
      case 'multi_track':
        progress = maxActivitiesCount;
        break;
      case 'skin_in_the_game':
        progress = stakeCount;
        break;
      case 'high_stakes':
        progress = maxStakeUSD;
        break;
      case 'escrow_victor':
        progress = refundedStakesCount;
        break;
      case 'note_taker':
      case 'daily_chronicler':
        progress = totalNotesCount;
        break;
      case 'fifty_checks':
      case 'centurion_logger':
        progress = totalCompletedChecks;
        break;
      case 'proof_of_work':
        progress = proofSubmittedCount;
        break;
      case 'community_cheer':
        progress = totalCheers;
        break;
      default:
        progress = 0;
    }

    const isUnlocked = progress >= def.target || existingMap.has(def.key);
    let awardedAt: string | undefined = undefined;

    if (isUnlocked) {
      if (!existingMap.has(def.key)) {
        const newBadgeId = generateId();
        try {
          insertBadgeStmt.run(newBadgeId, userId, def.key, def.title, def.description, now);
          awardedAt = now;
        } catch {
          awardedAt = now;
        }
      } else {
        awardedAt = existingMap.get(def.key)!.awarded_at;
      }
    }

    const progressClamped = Math.min(progress, def.target);
    const progressPercent = def.target > 0 ? Math.min(100, Math.round((progressClamped / def.target) * 100)) : 0;

    let progressText = `${progressClamped}/${def.target} ${def.unit}`;
    if (def.key === 'high_stakes') {
      progressText = `$${progressClamped}/$${def.target}`;
    }

    let formattedAwardedDate: string | undefined = undefined;
    if (awardedAt) {
      const d = new Date(awardedAt);
      formattedAwardedDate = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    }

    results.push({
      ...def,
      isUnlocked,
      awardedAt,
      formattedAwardedDate,
      currentProgress: progressClamped,
      progressPercent: isUnlocked ? 100 : progressPercent,
      progressText
    });
  }

  return results;
}
