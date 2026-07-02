import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

vi.mock('@prisma/client', () => {
  const prismaMock = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const app = (await import('../src/app')).default;

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a login with missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('rejects a login for a username that does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'whatever' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('rejects a login with the wrong password', async () => {
    const hashed = await bcrypt.hash('correct-password', 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      password: hashed,
      role: 'admin',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong-password' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('logs in successfully with the right credentials and returns a token', async () => {
    const hashed = await bcrypt.hash('correct-password', 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      password: hashed,
      role: 'admin',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.username).toBe('admin');
  });
});
