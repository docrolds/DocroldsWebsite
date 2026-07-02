import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const paymentsCreateMock = vi.fn();

vi.mock('square', () => {
  return {
    SquareClient: vi.fn(function SquareClient() {
      return { payments: { create: paymentsCreateMock } };
    }),
    SquareEnvironment: { Sandbox: 'sandbox', Production: 'production' },
  };
});

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock('@prisma/client', () => {
  const prismaMock = {
    customer: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    beat: {
      findMany: vi.fn(),
    },
    order: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
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
  customer: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  beat: { findMany: ReturnType<typeof vi.fn> };
  order: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  notification: { create: ReturnType<typeof vi.fn> };
};

const app = (await import('../src/app')).default;

const CUSTOMER = {
  id: 'customer-1',
  email: 'buyer@example.com',
  firstName: 'Buyer',
  isGuest: true,
};

const BEAT = { id: 'beat-1', title: 'Midnight Vibes', price: 50 };

const ORDER = {
  id: 'order-1',
  orderNumber: 'DR-2026-00001',
  customerId: CUSTOMER.id,
  downloadToken: 'token-abc',
  total: 50,
  customer: CUSTOMER,
  items: [
    {
      beat: { title: BEAT.title },
      licenseType: 'STANDARD',
      licenseName: 'Standard Lease',
      price: 50,
    },
  ],
};

function setupHappyPathMocks(): void {
  prismaMock.customer.findUnique.mockResolvedValue(CUSTOMER);
  prismaMock.beat.findMany.mockResolvedValue([BEAT]);
  prismaMock.order.count.mockResolvedValue(0);
  prismaMock.order.create.mockResolvedValue({
    id: ORDER.id,
    orderNumber: ORDER.orderNumber,
  });
  prismaMock.order.update.mockResolvedValue({});
  prismaMock.order.findUnique.mockResolvedValue(ORDER);
  prismaMock.notification.create.mockResolvedValue({});
}

describe('POST /api/checkout/process-payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects checkout with no payment source', async () => {
    const res = await request(app)
      .post('/api/checkout/process-payment')
      .send({ items: [{ beatId: 'beat-1', licenseType: 'STANDARD' }], customer: { email: 'a@b.com' } });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/payment source/i);
  });

  it('rejects checkout with an empty cart', async () => {
    const res = await request(app)
      .post('/api/checkout/process-payment')
      .send({ sourceId: 'cnon:card-nonce-ok', items: [], customer: { email: 'a@b.com' } });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cart is empty/i);
  });

  it('completes a purchase and marks the order PAID when Square approves the payment', async () => {
    setupHappyPathMocks();
    paymentsCreateMock.mockResolvedValue({
      payment: { id: 'square-payment-1', status: 'COMPLETED' },
    });

    const res = await request(app)
      .post('/api/checkout/process-payment')
      .send({
        sourceId: 'cnon:card-nonce-ok',
        items: [{ beatId: BEAT.id, licenseType: 'STANDARD' }],
        customer: { email: CUSTOMER.email, firstName: 'Buyer' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orderNumber).toBe(ORDER.orderNumber);
    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', paymentStatus: 'PAID' }),
      })
    );
  });

  it('marks the order FAILED and returns an error when Square declines the payment', async () => {
    setupHappyPathMocks();
    paymentsCreateMock.mockResolvedValue({
      payment: { id: 'square-payment-2', status: 'FAILED' },
    });

    const res = await request(app)
      .post('/api/checkout/process-payment')
      .send({
        sourceId: 'cnon:card-nonce-declined',
        items: [{ beatId: BEAT.id, licenseType: 'STANDARD' }],
        customer: { email: CUSTOMER.email },
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED', paymentStatus: 'FAILED' }),
      })
    );
  });

  it('returns a clean error message when Square throws a payment API error', async () => {
    setupHappyPathMocks();
    paymentsCreateMock.mockRejectedValue({
      errors: [{ detail: 'Card declined', code: 'CARD_DECLINED' }],
    });

    const res = await request(app)
      .post('/api/checkout/process-payment')
      .send({
        sourceId: 'cnon:card-nonce-error',
        items: [{ beatId: BEAT.id, licenseType: 'STANDARD' }],
        customer: { email: CUSTOMER.email },
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Card declined');
  });
});
