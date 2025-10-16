import { vi } from 'vitest';

// Mock environment variables
vi.mock('process', () => ({
  env: {
    JWT_SECRET: 'test-secret-key',
    DATABASE_URL: 'mysql://test:test@localhost:3306/test',
    NODE_ENV: 'test'
  }
}));

// Mock Prisma client
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    oauthAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    verificationToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    }
  }
}));

// Global test setup
beforeEach(() => {
  vi.clearAllMocks();
});
