import type {
  Challenge,
  Activity,
  DailyRecord,
  DayEvaluation,
  ActivityStats,
  HeatmapCell,
  ChallengeAnalytics,
  Milestone
} from './types';

// Safe date arithmetic preserving YYYY-MM-DD
export function getLocalTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateStr: string, daysToAdd: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + daysToAdd);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calculateEndDate(startDateStr: string, duration: number): string {
  return addDays(startDateStr, Math.max(0, duration - 1));
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function formatDayOfWeek(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return DAY_NAMES[d.getDay()];
}

export function calculateChallengeAnalytics(
  challenge: Challenge,
  activities: Activity[],
  records: DailyRecord[],
  todayOverride?: string
): ChallengeAnalytics {
  const todayStr = todayOverride || getLocalTodayDateString();
  const activeActivities = activities.filter((a) => a.is_active);

  // Group records by "date:activityId"
  const recordMap = new Map<string, DailyRecord>();
  for (const r of records) {
    recordMap.set(`${r.date}:${r.activity_id}`, r);
  }

  const days: DayEvaluation[] = [];
  let totalCompletedActivities = 0;

  for (let i = 0; i < challenge.duration; i++) {
    const dateStr = addDays(challenge.start_date, i);
    const dayNumber = i + 1;
    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;
    const isFuture = dateStr > todayStr;

    const dayRecords: Record<string, DailyRecord> = {};
    let applicableCount = 0;
    let completedCount = 0;
    let missedCount = 0;

    for (const activity of activeActivities) {
      const rec = recordMap.get(`${dateStr}:${activity.id}`);
      if (rec) {
        dayRecords[activity.id] = rec;
        if (rec.status === 'completed') {
          completedCount++;
          applicableCount++;
          totalCompletedActivities++;
        } else if (rec.status === 'missed') {
          missedCount++;
          applicableCount++;
        } else if (rec.status === 'pending') {
          applicableCount++;
        }
        // 'na' is not added to applicableCount
      } else {
        // Unset cell default is pending
        applicableCount++;
      }
    }

    // Evaluate success for this day
    let isSuccessful = false;
    if (applicableCount > 0) {
      if (challenge.success_rule === 'all') {
        isSuccessful = completedCount === applicableCount;
      } else if (challenge.success_rule === 'at_least_one') {
        isSuccessful = completedCount >= 1;
      } else if (challenge.success_rule === 'custom_min') {
        const threshold = Math.min(challenge.success_min_count, applicableCount);
        isSuccessful = completedCount >= threshold;
      }
    }

    const isPerfect = applicableCount > 0 && completedCount === applicableCount;
    const isMissed = isPast && !isSuccessful;

    days.push({
      date: dateStr,
      dayNumber,
      dayOfWeek: formatDayOfWeek(dateStr),
      shortDate: formatShortDate(dateStr),
      isToday,
      isPast,
      isFuture,
      records: dayRecords,
      applicableCount,
      completedCount,
      missedCount,
      isSuccessful,
      isPerfect,
      isMissed
    });
  }

  // Elapsed days (days up to today, clamped to duration)
  const elapsedDays = days.filter((d) => !d.isFuture).length;
  const remainingDays = Math.max(0, challenge.duration - elapsedDays);
  const totalSuccessfulDays = days.filter((d) => d.isSuccessful).length;
  const totalMissedDays = days.filter((d) => d.isMissed).length;
  const perfectDays = days.filter((d) => d.isPerfect).length;

  const completionPercentage =
    elapsedDays > 0 ? Math.round((totalSuccessfulDays / elapsedDays) * 100) : 0;

  // Streak calculations
  const todayDayIndex = days.findIndex((d) => d.isToday);
  let currentStreak = 0;

  if (todayDayIndex !== -1) {
    const todayEval = days[todayDayIndex];
    if (todayEval.isSuccessful) {
      // Count today and walk backwards
      currentStreak = 1;
      for (let i = todayDayIndex - 1; i >= 0; i--) {
        if (days[i].isSuccessful) {
          currentStreak++;
        } else {
          break;
        }
      }
    } else {
      // Today is still in progress / pending. Check if yesterday was successful.
      if (todayDayIndex > 0 && days[todayDayIndex - 1].isSuccessful) {
        for (let i = todayDayIndex - 1; i >= 0; i--) {
          if (days[i].isSuccessful) {
            currentStreak++;
          } else {
            break;
          }
        }
      } else {
        currentStreak = 0;
      }
    }
  } else {
    // If today is past the challenge duration, check from the end
    const lastElapsed = days.filter((d) => !d.isFuture);
    for (let i = lastElapsed.length - 1; i >= 0; i--) {
      if (lastElapsed[i].isSuccessful) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  for (const day of days) {
    if (day.isFuture) break;
    if (day.isSuccessful) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  // Activity stats
  const activityStats: ActivityStats[] = activeActivities.map((activity) => {
    let compDays = 0;
    let missDays = 0;
    let appDays = 0;

    for (const day of days) {
      if (day.isFuture) continue;
      const r = day.records[activity.id];
      const status = r ? r.status : 'pending';
      if (status !== 'na') {
        appDays++;
        if (status === 'completed') {
          compDays++;
        } else if (status === 'missed') {
          missDays++;
        }
      }
    }

    // Activity streak
    let actStreak = 0;
    if (todayDayIndex !== -1) {
      const todayStatus = days[todayDayIndex].records[activity.id]?.status;
      if (todayStatus === 'completed') {
        actStreak = 1;
        for (let i = todayDayIndex - 1; i >= 0; i--) {
          if (days[i].records[activity.id]?.status === 'completed') {
            actStreak++;
          } else {
            break;
          }
        }
      } else if (todayDayIndex > 0 && days[todayDayIndex - 1].records[activity.id]?.status === 'completed') {
        for (let i = todayDayIndex - 1; i >= 0; i--) {
          if (days[i].records[activity.id]?.status === 'completed') {
            actStreak++;
          } else {
            break;
          }
        }
      }
    }

    const rate = appDays > 0 ? Math.round((compDays / appDays) * 100) : 0;

    return {
      activity,
      completedDays: compDays,
      missedDays: missDays,
      applicableDays: appDays,
      completionRate: rate,
      currentStreak: actStreak
    };
  });

  // Heatmap
  const heatmap: HeatmapCell[] = days.map((day) => {
    let level: 0 | 1 | 2 | 3 = 0;
    if (day.completedCount === 0) {
      level = 0;
    } else if (day.completedCount === 1) {
      level = 1;
    } else if (day.completedCount === 2) {
      level = 2;
    } else {
      level = 3;
    }

    return {
      date: day.date,
      dayNumber: day.dayNumber,
      shortDate: day.shortDate,
      level,
      completedCount: day.completedCount,
      isSuccessful: day.isSuccessful,
      isToday: day.isToday
    };
  });

  const avgActivitiesPerActiveDay =
    totalSuccessfulDays > 0
      ? Number((totalCompletedActivities / totalSuccessfulDays).toFixed(1))
      : 0;

  return {
    totalDays: challenge.duration,
    currentDayNumber: todayDayIndex !== -1 ? todayDayIndex + 1 : Math.min(challenge.duration, elapsedDays + 1),
    elapsedDays,
    remainingDays,
    totalSuccessfulDays,
    totalMissedDays,
    perfectDays,
    completionPercentage,
    currentStreak,
    longestStreak,
    totalCompletedActivities,
    avgActivitiesPerActiveDay,
    activityStats,
    heatmap,
    days
  };
}

export const DEFAULT_MILESTONE_TARGETS = [7, 14, 21, 30, 50, 75, 100];

export function checkMilestones(
  challengeId: string,
  currentStreak: number,
  existingMilestones: Milestone[]
): { reached: number[]; newlyReached: number[] } {
  const reached: number[] = [];
  const newlyReached: number[] = [];

  for (const m of existingMilestones) {
    if (currentStreak >= m.target_days) {
      reached.push(m.target_days);
      if (!m.reached) {
        newlyReached.push(m.target_days);
      }
    }
  }

  return { reached, newlyReached };
}
