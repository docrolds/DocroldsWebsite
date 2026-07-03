import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const paymentsCreateMock = vi.fn();

vi.mock('square', () => ({
  SquareClient: vi.fn(function SquareClient() {
    return { payments: { create: paymentsCreateMock } };
  }),
  SquareEnvironment: { Sandbox: 'sandbox', Production: 'production' },
}));

vi.mock('@prisma/client', () => {
  const prismaMock = {
    customer: { findUnique: vi.fn(), create: vi.fn() },
    booking: { count: vi.fn(), create: vi.fn() },
    promo: { findUnique: vi.fn() },
  };
  return {
    PrismaClient: vi.fn(function PrismaClient() {
      return prismaMock;
    }),
    Prisma: { JsonNull: null },
  };
});

const { PrismaClient } = await import('@prisma/client');
const prismaMock = new PrismaClient() as unknown as {
  customer: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  booking: { count: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  promo: { findUnique: ReturnType<typeof vi.fn> };
};

const app = (await import('../src/app')).default;

const CUSTOMER = { name: 'Test Customer', email: 'booker@example.com', phone: '5555550100' };

function setupMocks(): void {
  prismaMock.customer.findUnique.mockResolvedValue(null);
  prismaMock.customer.create.mockResolvedValue({ id: 'cust-1', isGuest: true });
  prismaMock.booking.count.mockResolvedValue(0);
  prismaMock.booking.create.mockResolvedValue({
    bookingNumber: 'BK-2026-00001',
    depositAmount: 0,
    balanceAmount: 0,
    sessionPrice: 0,
    category: 'RECORDING',
    email: CUSTOMER.email,
    name: CUSTOMER.name,
  });
}

describe('POST /api/bookings/create - server-side pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores a client-submitted deposit/total and charges the server-computed price', async () => {
    setupMocks();
    paymentsCreateMock.mockResolvedValue({
      payment: { id: 'square-payment-1', status: 'COMPLETED' },
    });

    // 1 hour of recording at the base $80/hr rate = $80, $25 deposit.
    // The tampered depositAmount/totalAmount below should be ignored entirely.
    await request(app)
      .post('/api/bookings/create')
      .send({
        category: 'recording',
        hours: 1,
        customer: CUSTOMER,
        sourceId: 'cnon:card-nonce-ok',
        depositAmount: 0.01,
        totalAmount: 0.01,
      });

    expect(paymentsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMoney: expect.objectContaining({ amount: BigInt(2500) }), // $25.00 in cents
      })
    );
  });

  it('rejects a booking with no resolvable price (unknown mixing tier)', async () => {
    setupMocks();

    const res = await request(app)
      .post('/api/bookings/create')
      .send({
        category: 'mixing',
        mixingTier: 'NOT_A_REAL_TIER',
        customer: CUSTOMER,
        sourceId: 'cnon:card-nonce-ok',
      });

    expect(res.status).toBe(400);
    expect(paymentsCreateMock).not.toHaveBeenCalled();
  });

  it('rejects in-person delivery for a tier that does not allow it', async () => {
    setupMocks();

    const res = await request(app)
      .post('/api/bookings/create')
      .send({
        category: 'mixing',
        mixingTier: 'BASIC', // allowInPerson: false
        mixingDelivery: 'in-person',
        customer: CUSTOMER,
        sourceId: 'cnon:card-nonce-ok',
      });

    expect(res.status).toBe(400);
    expect(paymentsCreateMock).not.toHaveBeenCalled();
  });

  it('prices a promo booking from the database, not the client', async () => {
    setupMocks();
    prismaMock.promo.findUnique.mockResolvedValue({
      id: 'promo-1',
      active: true,
      price: 199,
    });
    paymentsCreateMock.mockResolvedValue({
      payment: { id: 'square-payment-2', status: 'COMPLETED' },
    });

    await request(app)
      .post('/api/bookings/create')
      .send({
        category: 'promo',
        promoId: 'promo-1',
        customer: CUSTOMER,
        sourceId: 'cnon:card-nonce-ok',
        totalAmount: 1, // tampered - should be ignored in favor of the $25 deposit
      });

    expect(paymentsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMoney: expect.objectContaining({ amount: BigInt(2500) }), // $25 deposit, not the promo total
      })
    );
  });
});
