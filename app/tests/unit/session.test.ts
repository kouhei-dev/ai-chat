import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// prismaのモック（セッションモジュールのインポート時に必要）
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { generateSessionId, calculateExpiryDate } from '@/lib/session';

describe('Session Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // 環境変数をリセット
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // テスト後に環境変数を復元
    process.env = originalEnv;
  });

  describe('generateSessionId', () => {
    it('UUIDv4形式のセッションIDを生成する', () => {
      const sessionId = generateSessionId();

      // UUID形式の検証（8-4-4-4-12の形式）
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(sessionId).toMatch(uuidRegex);
    });

    it('呼び出すたびに異なるIDを生成する', () => {
      const sessionId1 = generateSessionId();
      const sessionId2 = generateSessionId();

      expect(sessionId1).not.toBe(sessionId2);
    });
  });

  describe('calculateExpiryDate', () => {
    it('Date型のオブジェクトを返す', () => {
      const expiryDate = calculateExpiryDate();
      expect(expiryDate).toBeInstanceOf(Date);
    });

    it('未来の日時を返す', () => {
      const now = new Date();
      const expiryDate = calculateExpiryDate();
      expect(expiryDate.getTime()).toBeGreaterThan(now.getTime());
    });

    it('環境変数が未設定の場合、デフォルトで24時間後を返す', () => {
      delete process.env.SESSION_EXPIRY_HOURS;

      vi.resetModules();

      const before = new Date();
      const expiryDate = calculateExpiryDate();

      // 24時間後（86400000ミリ秒）の範囲内であることを確認
      const expectedMs = 24 * 60 * 60 * 1000;
      const actualDiff = expiryDate.getTime() - before.getTime();

      // 1秒の誤差を許容
      expect(actualDiff).toBeGreaterThanOrEqual(expectedMs - 1000);
      expect(actualDiff).toBeLessThanOrEqual(expectedMs + 1000);
    });

    it('環境変数SESSION_EXPIRY_HOURSで有効期限を設定できる', async () => {
      // 環境変数を設定（12時間）
      process.env.SESSION_EXPIRY_HOURS = '12';

      vi.resetModules();
      const { calculateExpiryDate: calcExpiry } = await import('@/lib/session');

      const before = new Date();
      const expiryDate = calcExpiry();

      // 12時間後の範囲内であることを確認
      const expectedMs = 12 * 60 * 60 * 1000;
      const actualDiff = expiryDate.getTime() - before.getTime();

      // 1秒の誤差を許容
      expect(actualDiff).toBeGreaterThanOrEqual(expectedMs - 1000);
      expect(actualDiff).toBeLessThanOrEqual(expectedMs + 1000);
    });

    it('環境変数に不正な値が設定された場合、エラーをスローする', async () => {
      process.env.SESSION_EXPIRY_HOURS = 'invalid';

      vi.resetModules();
      const { calculateExpiryDate: calcExpiry } = await import('@/lib/session');

      expect(() => calcExpiry()).toThrow();
    });

    it('環境変数に0以下の値が設定された場合、エラーをスローする', async () => {
      process.env.SESSION_EXPIRY_HOURS = '0';

      vi.resetModules();
      const { calculateExpiryDate: calcExpiry } = await import('@/lib/session');

      expect(() => calcExpiry()).toThrow();
    });

    it('環境変数に負の値が設定された場合、エラーをスローする', async () => {
      process.env.SESSION_EXPIRY_HOURS = '-5';

      vi.resetModules();
      const { calculateExpiryDate: calcExpiry } = await import('@/lib/session');

      expect(() => calcExpiry()).toThrow();
    });
  });
});
