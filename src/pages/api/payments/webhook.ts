import type { APIRoute } from 'astro';
import { verifyWebhookSignature, verifyAndActivateStakePayment } from '../../../lib/payment';

export const POST: APIRoute = async ({ request }) => {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-streakgrid-signature') || request.headers.get('stripe-signature') || '';

    // Signature verification check
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid && process.env.NODE_ENV === 'production') {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = JSON.parse(rawBody);
    const { eventType, providerPaymentId, challengeId } = payload;

    if (eventType === 'payment.succeeded' || eventType === 'payment.authorized') {
      if (providerPaymentId && challengeId) {
        verifyAndActivateStakePayment(providerPaymentId, challengeId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: 'Webhook processing failed.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
