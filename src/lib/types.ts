export type SuccessRule = 'all' | 'at_least_one' | 'custom_min';

export type RecordStatus = 'pending' | 'completed' | 'missed' | 'na';

export type ChallengeType = 'free' | 'stake';

export type Visibility = 'private' | 'community' | 'public';

export type StakeStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'active'
  | 'refundable'
  | 'refunded'
  | 'forfeited'
  | 'disputed'
  | 'cancelled';

export type SettlementStatus =
  | 'unsettled'
  | 'eligible'
  | 'refund_processing'
  | 'refunded'
  | 'forfeited'
  | 'disputed';

export type TransactionType = 'deposit' | 'refund' | 'fee' | 'forfeiture';

export type TransactionStatus = 'pending' | 'completed' | 'failed';

export type ReactionType = 'heart' | 'fire' | 'clap';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  username?: string;
  avatar_url?: string;
  country?: string;
  is_admin?: number;
  created_at: string;
  preferences?: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: number;
}

export interface Challenge {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  start_date: string; // YYYY-MM-DD
  duration: number; // e.g. 30, 50, 100
  end_date: string; // YYYY-MM-DD
  success_rule: SuccessRule;
  success_min_count: number;
  challenge_type?: ChallengeType;
  visibility?: Visibility;
  timezone?: string;
  public_slug?: string;
  allow_comments?: number;
  show_stake_amount?: number;
  proof_required?: number;
  proof_note?: string;
  proof_url?: string;
  settlement_status?: SettlementStatus;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

export interface StakeCommitment {
  id: string;
  challenge_id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: StakeStatus;
  payment_provider: string;
  provider_payment_id?: string;
  platform_fee: number;
  created_at: string;
  activated_at?: string;
  settled_at?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  challenge_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  provider_reference?: string;
  created_at: string;
}

export interface Comment {
  id: string;
  challenge_id: string;
  user_id: string;
  content: string;
  status: 'active' | 'hidden' | 'reported';
  created_at: string;
  author_name?: string;
  author_avatar?: string;
}

export interface Reaction {
  id: string;
  challenge_id: string;
  user_id: string;
  type: ReactionType;
  created_at: string;
}

export interface Dispute {
  id: string;
  challenge_id: string;
  user_id: string;
  reason: string;
  evidence_url?: string;
  status: 'under_review' | 'upheld' | 'reversed' | 'dismissed';
  resolution_note?: string;
  resolved_by?: string;
  created_at: string;
  resolved_at?: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: string;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  challenge_id?: string;
  badge_key: string;
  title: string;
  description?: string;
  awarded_at: string;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  challenge_id?: string;
  type: string;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
}

export interface Activity {
  id: string;
  challenge_id: string;
  name: string;
  icon: string;
  sort_order: number;
  is_active: number;
  created_at: string;
}

export interface DailyRecord {
  id: string;
  challenge_id: string;
  activity_id: string;
  date: string; // YYYY-MM-DD
  status: RecordStatus;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  challenge_id: string;
  target_days: number;
  reached: number;
  reached_at?: string;
}

export interface Invite {
  id: string;
  inviter_id: string;
  code: string;
  uses_count: number;
  created_at: string;
}

export interface DayEvaluation {
  date: string;
  dayNumber: number;
  dayOfWeek: string;
  shortDate: string; // e.g. "Sep 20"
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  records: Record<string, DailyRecord>; // activityId -> record
  applicableCount: number;
  completedCount: number;
  missedCount: number;
  isSuccessful: boolean;
  isPerfect: boolean;
  isMissed: boolean;
}

export interface ActivityStats {
  activity: Activity;
  completedDays: number;
  missedDays: number;
  applicableDays: number;
  completionRate: number; // 0..100
  currentStreak: number;
}

export interface HeatmapCell {
  date: string;
  dayNumber: number;
  shortDate: string;
  level: 0 | 1 | 2 | 3;
  completedCount: number;
  isSuccessful: boolean;
  isToday: boolean;
}

export interface ChallengeAnalytics {
  totalDays: number;
  currentDayNumber: number;
  elapsedDays: number;
  remainingDays: number;
  totalSuccessfulDays: number;
  totalMissedDays: number;
  perfectDays: number;
  completionPercentage: number;
  currentStreak: number;
  longestStreak: number;
  totalCompletedActivities: number;
  avgActivitiesPerActiveDay: number;
  activityStats: ActivityStats[];
  heatmap: HeatmapCell[];
  days: DayEvaluation[];
}
