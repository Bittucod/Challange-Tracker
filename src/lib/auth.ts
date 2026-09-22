import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';
import { db } from './db';
import type { User, Session } from './types';

export const SESSION_COOKIE_NAME = 'streakgrid_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function generateId(): string {
  return crypto.randomUUID();
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export function createSession(userId: string): string {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(sessionId, userId, expiresAt);

  return sessionId;
}

export function deleteSession(sessionId: string): void {
  const stmt = db.prepare(`DELETE FROM sessions WHERE id = ?`);
  stmt.run(sessionId);
}

export function getUserFromSession(sessionId: string): User | null {
  if (!sessionId) return null;

  const now = Date.now();
  const sessionStmt = db.prepare(`
    SELECT * FROM sessions WHERE id = ? AND expires_at > ?
  `);
  const session = sessionStmt.get(sessionId, now) as Session | undefined;

  if (!session) {
    // Delete expired session if found
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
    return null;
  }

  const userStmt = db.prepare(`
    SELECT id, email, password_hash, name, created_at, preferences
    FROM users WHERE id = ?
  `);
  const user = userStmt.get(session.user_id) as User | undefined;

  return user || null;
}

export function getUserFromCookies(cookies: AstroCookies): User | null {
  const cookie = cookies.get(SESSION_COOKIE_NAME);
  if (!cookie || !cookie.value) return null;
  return getUserFromSession(cookie.value);
}

export function setSessionCookie(cookies: AstroCookies, sessionId: string): void {
  cookies.set(SESSION_COOKIE_NAME, sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30 // 30 days in seconds
  });
}

export function clearSessionCookie(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE_NAME, {
    path: '/'
  });
}
