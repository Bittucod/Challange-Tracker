import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'streakgrid.db');

export const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency and crash resilience
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Safe migration helper to add column if it does not exist
function ensureColumn(tableName: string, columnName: string, columnDef: string) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    const exists = columns.some((c) => c.name === columnName);
    if (!exists) {
      db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`).run();
    }
  } catch (err) {
    console.error(`Error ensuring column ${columnName} on ${tableName}:`, err);
  }
}

// Initialize database schema and migrations
export function initDb() {
  // 1. Core Existing Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      preferences TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      duration INTEGER NOT NULL,
      end_date TEXT NOT NULL,
      success_rule TEXT NOT NULL DEFAULT 'all',
      success_min_count INTEGER NOT NULL DEFAULT 1,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'target',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_records (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(challenge_id, activity_id, date)
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      target_days INTEGER NOT NULL,
      reached INTEGER NOT NULL DEFAULT 0,
      reached_at TEXT,
      UNIQUE(challenge_id, target_days)
    );

    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code TEXT UNIQUE NOT NULL,
      uses_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // 2. Safe Column Additions for Users
  ensureColumn('users', 'username', "TEXT DEFAULT ''");
  ensureColumn('users', 'avatar_url', "TEXT DEFAULT ''");
  ensureColumn('users', 'country', "TEXT DEFAULT 'IN'");
  ensureColumn('users', 'is_admin', 'INTEGER DEFAULT 0');

  // 3. Safe Column Additions for Challenges
  ensureColumn('challenges', 'challenge_type', "TEXT DEFAULT 'free'");
  ensureColumn('challenges', 'visibility', "TEXT DEFAULT 'private'");
  ensureColumn('challenges', 'timezone', "TEXT DEFAULT 'UTC'");
  ensureColumn('challenges', 'public_slug', 'TEXT');
  ensureColumn('challenges', 'allow_comments', 'INTEGER DEFAULT 1');
  ensureColumn('challenges', 'show_stake_amount', 'INTEGER DEFAULT 1');
  ensureColumn('challenges', 'proof_required', 'INTEGER DEFAULT 0');
  ensureColumn('challenges', 'proof_note', 'TEXT');
  ensureColumn('challenges', 'proof_url', 'TEXT');
  ensureColumn('challenges', 'settlement_status', "TEXT DEFAULT 'unsettled'");

  // 4. Create New Tables for Real-Stakes Accountability & Community
  db.exec(`
    -- Stake Commitments (Escrow tracking)
    CREATE TABLE IF NOT EXISTS stake_commitments (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'pending',
      payment_provider TEXT NOT NULL DEFAULT 'mock_escrow',
      provider_payment_id TEXT,
      platform_fee REAL DEFAULT 0,
      created_at TEXT NOT NULL,
      activated_at TEXT,
      settled_at TEXT
    );

    -- Immutable Financial Ledger
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      provider_reference TEXT,
      created_at TEXT NOT NULL
    );

    -- Public Community Comments
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    -- Public Community Reactions (Encouragement: heart, fire, clap)
    CREATE TABLE IF NOT EXISTS reactions (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(challenge_id, user_id, type)
    );

    -- Dispute System
    CREATE TABLE IF NOT EXISTS disputes (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      evidence_url TEXT,
      status TEXT NOT NULL DEFAULT 'under_review',
      resolution_note TEXT,
      resolved_by TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    -- Immutable Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    -- Permanent Achievement Badges
    CREATE TABLE IF NOT EXISTS user_badges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_id TEXT REFERENCES challenges(id) ON DELETE SET NULL,
      badge_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      awarded_at TEXT NOT NULL
    );

    -- In-App User Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_id TEXT REFERENCES challenges(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Indices for Performance
    CREATE INDEX IF NOT EXISTS idx_challenges_user ON challenges(user_id);
    CREATE INDEX IF NOT EXISTS idx_challenges_visibility ON challenges(visibility);
    CREATE INDEX IF NOT EXISTS idx_challenges_type ON challenges(challenge_type);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_activities_challenge ON activities(challenge_id);
    CREATE INDEX IF NOT EXISTS idx_records_challenge_date ON daily_records(challenge_id, date);
    CREATE INDEX IF NOT EXISTS idx_records_activity ON daily_records(activity_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
    CREATE INDEX IF NOT EXISTS idx_commitments_challenge ON stake_commitments(challenge_id);
    CREATE INDEX IF NOT EXISTS idx_commitments_user ON stake_commitments(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_challenge ON transactions(challenge_id);
    CREATE INDEX IF NOT EXISTS idx_comments_challenge ON comments(challenge_id);
    CREATE INDEX IF NOT EXISTS idx_reactions_challenge ON reactions(challenge_id);
    CREATE INDEX IF NOT EXISTS idx_disputes_challenge ON disputes(challenge_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
  `);
}

// Automatically ensure schema is initialized upon import
initDb();
