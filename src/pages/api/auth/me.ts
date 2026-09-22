import type { APIRoute } from 'astro';
import { getUserFromCookies } from '../../../lib/auth';

export const GET: APIRoute = async ({ cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(
    JSON.stringify({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at
      }
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
