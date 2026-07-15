import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('square', () => ({
  SquareClient: vi.fn(function SquareClient() {
    return { payments: { create: vi.fn() } };
  }),
  SquareEnvironment: { Sandbox: 'sandbox', Production: 'production' },
}));

vi.mock('@prisma/client', () => {
  const prismaMock = {
    order: { findFirst: vi.fn(), update: vi.fn() },
  };
  return {
    PrismaClient: vi.fn(function PrismaClient() {
      return prismaMock;
    }),
    Prisma: { JsonNull: null },
  };
});

const app = (await import('../src/app')).default;

describe('POST /api/webhooks/square - fails closed when unconfigured', () => {
  it('rejects a webhook event when SQUARE_WEBHOOK_SIGNATURE_KEY is not set', async () => {
    // tests/setup.ts intentionally does not set SQUARE_WEBHOOK_SIGNATURE_KEY
    // or SQUARE_WEBHOOK_NOTIFICATION_URL, matching production's current
    // unconfigured state - this must reject, not silently accept.
    const res = await request(app)
      .post('/api/webhooks/square')
      .send({
        type: 'refund.created',
        data: { type: 'refund', id: 'evt-1', object: { refund: { payment_id: 'fake-payment-id' } } },
      });

    expect(res.status).toBe(401);
  });

  it('rejects even with a well-formed but arbitrary signature header', async () => {
    const res = await request(app)
      .post('/api/webhooks/square')
      .set('x-square-hmacsha256-signature', 'not-a-real-signature')
      .send({
        type: 'refund.created',
        data: { type: 'refund', id: 'evt-2', object: { refund: { payment_id: 'fake-payment-id' } } },
      });

    expect(res.status).toBe(401);
  });
});
