import type { APIRoute } from 'astro';
import { clearSessionCookie, SESSION_COOKIE_NAME, deleteSession } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies }) => {
  const cookie = cookies.get(SESSION_COOKIE_NAME);
  if (cookie?.value) {
    deleteSession(cookie.value);
  }
  clearSessionCookie(cookies);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const GET: APIRoute = async ({ cookies }) => {
  const cookie = cookies.get(SESSION_COOKIE_NAME);
  if (cookie?.value) {
    deleteSession(cookie.value);
  }
  clearSessionCookie(cookies);

  return new Response(null, {
    status: 302,
    headers: { Location: '/login' }
  });
};
