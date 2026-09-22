import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db';
import { getUserFromCookies, generateId } from '../../../../lib/auth';
import { CONFIG } from '../../../../lib/config';
import type { Challenge, Comment, User } from '../../../../lib/types';

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing challenge ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const comments = db
    .prepare(`
      SELECT c.*, u.name as author_name, u.avatar_url as author_avatar
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.challenge_id = ? AND c.status = 'active'
      ORDER BY c.created_at ASC
    `)
    .all(id) as Array<Comment & { author_name: string; author_avatar?: string }>;

  return new Response(JSON.stringify({ comments }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Please sign in to comment.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!CONFIG.COMMENTS_ENABLED) {
    return new Response(JSON.stringify({ error: 'Comments are currently disabled.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing challenge ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const challenge = db
    .prepare('SELECT * FROM challenges WHERE id = ?')
    .get(id) as Challenge | undefined;

  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (challenge.allow_comments === 0) {
    return new Response(JSON.stringify({ error: 'Comments are disabled for this challenge.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return new Response(JSON.stringify({ error: 'Comment cannot be empty.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (content.length > 280) {
      return new Response(JSON.stringify({ error: 'Comment is too long (max 280 characters).' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const commentId = generateId();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO comments (id, challenge_id, user_id, content, status, created_at)
      VALUES (?, ?, ?, ?, 'active', ?)
    `).run(commentId, id, user.id, content, now);

    const created = {
      id: commentId,
      challenge_id: id,
      user_id: user.id,
      content,
      status: 'active',
      created_at: now,
      author_name: user.name,
      author_avatar: user.avatar_url
    };

    return new Response(JSON.stringify({ success: true, comment: created }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Post comment error:', err);
    return new Response(JSON.stringify({ error: 'Failed to post comment.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  const user = getUserFromCookies(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { id } = params;
  const url = new URL(request.url);
  const commentId = url.searchParams.get('commentId');

  if (!commentId || !id) {
    return new Response(JSON.stringify({ error: 'Missing commentId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const comment = db
    .prepare('SELECT * FROM comments WHERE id = ? AND challenge_id = ?')
    .get(commentId, id) as Comment | undefined;

  if (!comment) {
    return new Response(JSON.stringify({ error: 'Comment not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Only author or admin can delete
  if (comment.user_id !== user.id && !user.is_admin) {
    return new Response(JSON.stringify({ error: 'You can only delete your own comments.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
