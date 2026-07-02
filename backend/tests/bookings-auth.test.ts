import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('@prisma/client', () => {
  const prismaMock = {
    booking: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  };
  return {
    PrismaClient: vi.fn(function PrismaClient() {
      return prismaMock;
    }),
    Prisma: { JsonNull: null },
  };
});

vi.mock('square', () => ({
  SquareClient: vi.fn(function SquareClient() {
    return { payments: { create: vi.fn() }, bookings: { create: vi.fn() } };
  }),
  SquareEnvironment: { Sandbox: 'sandbox', Production: 'production' },
}));

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({ sendMail: vi.fn().mockResolvedValue({}) })),
}));

const app = (await import('../src/app')).default;

describe('Booking admin routes require admin authentication', () => {
  it('rejects GET /api/bookings with no token', async () => {
    const res = await request(app).get('/api/bookings');
    expect(res.status).toBe(401);
  });

  it('rejects GET /api/bookings/:id with no token', async () => {
    const res = await request(app).get('/api/bookings/some-id');
    expect(res.status).toBe(401);
  });

  it('rejects PUT /api/bookings/:id/status with no token', async () => {
    const res = await request(app)
      .put('/api/bookings/some-id/status')
      .send({ status: 'CONFIRMED' });
    expect(res.status).toBe(401);
  });

  it('rejects a customer token (wrong secret) on admin booking routes', async () => {
    // A customer JWT is signed with a different secret than admin tokens,
    // so it must not be accepted here even though it's a well-formed JWT.
    const jwt = await import('jsonwebtoken');
    const customerToken = jwt.default.sign(
      { id: 'cust-1', email: 'a@b.com' },
      'test-jwt-customer-secret'
    );

    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });
});
