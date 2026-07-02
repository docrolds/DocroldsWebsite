import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('@prisma/client', () => {
  const prismaMock = {
    beat: {
      findMany: vi.fn(),
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
  beat: { findMany: ReturnType<typeof vi.fn> };
};

const app = (await import('../src/app')).default;

describe('GET /api/beats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns beats from the database with like/comment counts flattened', async () => {
    prismaMock.beat.findMany.mockResolvedValue([
      {
        id: 'beat-1',
        title: 'Midnight Vibes',
        price: 50,
        _count: { likes: 3, comments: 1 },
      },
    ]);

    const res = await request(app).get('/api/beats');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].likeCount).toBe(3);
    expect(res.body[0].commentCount).toBe(1);
  });

  it('falls back to mock beats when the database has none', async () => {
    prismaMock.beat.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/beats');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
