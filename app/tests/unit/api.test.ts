import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testClient } from 'hono/testing';

// モックの設定（vi.mockはホイスティングされるため、vi.hoisted()で変数を定義）
const { mockCreateSession, mockValidateSession, mockGetSessionById, mockCleanupExpiredSessions } =
  vi.hoisted(() => ({
    mockCreateSession: vi.fn(),
    mockValidateSession: vi.fn(),
    mockGetSessionById: vi.fn(),
    mockCleanupExpiredSessions: vi.fn(),
  }));

vi.mock('@/lib/session', () => ({
  createSession: () => mockCreateSession(),
  validateSession: (sessionId: string) => mockValidateSession(sessionId),
  getSessionById: (sessionId: string) => mockGetSessionById(sessionId),
  cleanupExpiredSessions: () => mockCleanupExpiredSessions(),
}));

const { mockGenerateResponse } = vi.hoisted(() => ({
  mockGenerateResponse: vi.fn(),
}));

vi.mock('@/lib/mastra/agent', () => ({
  generateResponse: (message: string, history: unknown[]) => mockGenerateResponse(message, history),
}));

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    conversation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
    $runCommandRaw: vi.fn(),
  },
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

// モック適用後にappをインポート
import { app } from '@/lib/api/app';

describe('API Endpoints', () => {
  const client = testClient(app);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/health', () => {
    const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

    afterEach(() => {
      if (originalAnthropicKey !== undefined) {
        process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    });

    it('DB接続成功かつ環境変数設定済みの場合healthyを返す', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key';
      mockPrisma.$runCommandRaw.mockResolvedValue({ ok: 1 });

      const res = await client.api.health.$get();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('healthy');
      expect(json.checks.database.status).toBe('connected');
      expect(json.checks.configuration.anthropicApiKey).toBe('configured');
      expect(json.timestamp).toBeDefined();
      expect(json.responseTime).toBeDefined();
    });

    it('DB接続失敗の場合unhealthyを返す', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key';
      mockPrisma.$runCommandRaw.mockRejectedValue(new Error('Connection failed'));

      const res = await client.api.health.$get();
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.status).toBe('unhealthy');
      expect(json.checks.database.status).toBe('disconnected');
      expect(json.checks.database.error).toBe('Connection failed');
    });

    it('ANTHROPIC_API_KEY未設定の場合unhealthyを返す', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      mockPrisma.$runCommandRaw.mockResolvedValue({ ok: 1 });

      const res = await client.api.health.$get();
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.status).toBe('unhealthy');
      expect(json.checks.configuration.anthropicApiKey).toBe('missing');
    });
  });

  describe('POST /api/session', () => {
    it('新規セッションを作成して返す', async () => {
      const mockSession = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        expiresAt: new Date('2024-01-02T12:00:00.000Z'),
      };
      mockCreateSession.mockResolvedValue(mockSession);

      const res = await client.api.session.$post();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.sessionId).toBe(mockSession.sessionId);
      expect(json.expiresAt).toBe('2024-01-02T12:00:00.000Z');
    });

    it('エラー時に500を返す', async () => {
      mockCreateSession.mockRejectedValue(new Error('DB error'));

      const res = await client.api.session.$post();
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('セッションの作成に失敗しました');
    });
  });

  describe('GET /api/session/:sessionId', () => {
    it('有効なセッションの情報を返す', async () => {
      const mockResult = {
        valid: true,
        session: {
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          expiresAt: new Date('2024-01-02T12:00:00.000Z'),
        },
      };
      mockValidateSession.mockResolvedValue(mockResult);

      const res = await client.api.session[':sessionId'].$get({
        param: { sessionId: '550e8400-e29b-41d4-a716-446655440000' },
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.valid).toBe(true);
      expect(json.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('無効なセッションに対して400を返す', async () => {
      mockValidateSession.mockResolvedValue({
        valid: false,
        message: 'セッションが見つかりません',
      });

      const res = await client.api.session[':sessionId'].$get({
        param: { sessionId: 'invalid-session-id' },
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.valid).toBe(false);
      expect(json.message).toBe('セッションが見つかりません');
    });

    it('期限切れセッションに対して400を返す', async () => {
      mockValidateSession.mockResolvedValue({
        valid: false,
        message: 'セッションが期限切れです',
      });

      const res = await client.api.session[':sessionId'].$get({
        param: { sessionId: '550e8400-e29b-41d4-a716-446655440000' },
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.valid).toBe(false);
      expect(json.message).toBe('セッションが期限切れです');
    });
  });

  describe('POST /api/chat', () => {
    const validSessionId = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
      mockValidateSession.mockResolvedValue({
        valid: true,
        session: {
          sessionId: validSessionId,
          expiresAt: new Date('2024-01-02T12:00:00.000Z'),
        },
      });
      mockGetSessionById.mockResolvedValue({
        id: 'db-session-id',
        sessionId: validSessionId,
        expiresAt: new Date('2024-01-02T12:00:00.000Z'),
      });
    });

    it('メッセージが無い場合400を返す', async () => {
      const res = await client.api.chat.$post({
        json: { sessionId: validSessionId },
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('メッセージは必須です');
    });

    it('セッションIDが無い場合400を返す', async () => {
      const res = await client.api.chat.$post({
        json: { message: 'こんにちは' },
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('セッションIDは必須です');
    });

    it('空白のみのメッセージに対して400を返す', async () => {
      const res = await client.api.chat.$post({
        json: {
          message: '   ',
          sessionId: validSessionId,
        },
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('メッセージを入力してください');
    });

    it('最大文字数を超えるメッセージに対して400を返す', async () => {
      const longMessage = 'あ'.repeat(401); // 401文字（最大400文字を超える）
      const res = await client.api.chat.$post({
        json: {
          message: longMessage,
          sessionId: validSessionId,
        },
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('メッセージは400文字以内で入力してください');
    });

    it('無効なセッションに対して401を返す', async () => {
      // 有効なUUID形式だが、存在しないセッション
      const invalidButValidFormatSessionId = '00000000-0000-0000-0000-000000000000';
      mockValidateSession.mockResolvedValue({
        valid: false,
        message: 'セッションが無効または期限切れです',
      });

      const res = await client.api.chat.$post({
        json: {
          message: 'こんにちは',
          sessionId: invalidButValidFormatSessionId,
        },
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('セッションが無効または期限切れです');
    });

    it('不正な形式のセッションIDに対して400を返す', async () => {
      const res = await client.api.chat.$post({
        json: {
          message: 'こんにちは',
          sessionId: 'invalid-format',
        },
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('セッションIDの形式が不正です');
    });

    it('新規会話を作成してAI応答を返す', async () => {
      const conversationId = 'new-conversation-id';
      mockPrisma.conversation.create.mockResolvedValue({
        id: conversationId,
        sessionId: 'db-session-id',
        messages: [],
      });
      mockPrisma.message.create.mockResolvedValue({});
      mockGenerateResponse.mockResolvedValue('こんにちは！何かお手伝いできることはありますか？');

      const res = await client.api.chat.$post({
        json: {
          message: 'こんにちは',
          sessionId: validSessionId,
        },
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.response).toBe('こんにちは！何かお手伝いできることはありますか？');
      expect(json.conversationId).toBe(conversationId);
      expect(json.sessionId).toBe(validSessionId);
    });

    it('既存の会話に続けてメッセージを送信できる', async () => {
      // 有効なMongoDB ObjectId形式
      const conversationId = '507f1f77bcf86cd799439011';
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: conversationId,
        sessionId: 'db-session-id',
        messages: [
          { role: 'user', content: '最初のメッセージ' },
          { role: 'assistant', content: '最初の応答' },
        ],
      });
      mockPrisma.message.create.mockResolvedValue({});
      mockGenerateResponse.mockResolvedValue('続きの応答です。');

      const res = await client.api.chat.$post({
        json: {
          message: '続きのメッセージ',
          sessionId: validSessionId,
          conversationId: conversationId,
        },
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.response).toBe('続きの応答です。');
      expect(json.conversationId).toBe(conversationId);

      // 会話履歴が渡されていることを確認
      expect(mockGenerateResponse).toHaveBeenCalledWith('続きのメッセージ', [
        { role: 'user', content: '最初のメッセージ' },
        { role: 'assistant', content: '最初の応答' },
      ]);
    });

    it('存在しない会話IDに対して404を返す', async () => {
      // 有効なMongoDB ObjectId形式だが存在しない
      const nonExistentConversationId = '507f1f77bcf86cd799439099';
      mockPrisma.conversation.findFirst.mockResolvedValue(null);

      const res = await client.api.chat.$post({
        json: {
          message: 'こんにちは',
          sessionId: validSessionId,
          conversationId: nonExistentConversationId,
        },
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('会話が見つかりません');
    });

    it('不正な形式の会話IDに対して400を返す', async () => {
      const res = await client.api.chat.$post({
        json: {
          message: 'こんにちは',
          sessionId: validSessionId,
          conversationId: 'invalid-format',
        },
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('会話IDの形式が不正です');
    });

    it('セッションが見つからない場合404を返す', async () => {
      mockGetSessionById.mockResolvedValue(null);

      const res = await client.api.chat.$post({
        json: {
          message: 'こんにちは',
          sessionId: validSessionId,
        },
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('セッションが見つかりません');
    });
  });

  describe('POST /api/cleanup', () => {
    const originalEnv = process.env.CLEANUP_SECRET;

    beforeEach(() => {
      process.env.CLEANUP_SECRET = 'test-secret';
    });

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.CLEANUP_SECRET = originalEnv;
      } else {
        delete process.env.CLEANUP_SECRET;
      }
    });

    it('認証なしでリクエストした場合401を返す', async () => {
      const res = await client.api.cleanup.$post();
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('認証が必要です');
    });

    it('不正なトークンでリクエストした場合403を返す', async () => {
      const res = await client.api.cleanup.$post(undefined, {
        headers: { Authorization: 'Bearer wrong-token' },
      });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('認証に失敗しました');
    });

    it('CLEANUP_SECRETが未設定の場合503を返す', async () => {
      delete process.env.CLEANUP_SECRET;

      const res = await client.api.cleanup.$post(undefined, {
        headers: { Authorization: 'Bearer some-token' },
      });
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.error).toBe('クリーンアップ機能が設定されていません');
    });

    it('正しいトークンで認証成功し削除数を返す', async () => {
      mockCleanupExpiredSessions.mockResolvedValue(5);

      const res = await client.api.cleanup.$post(undefined, {
        headers: { Authorization: 'Bearer test-secret' },
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe('期限切れセッションを削除しました');
      expect(json.deletedCount).toBe(5);
    });
  });
});
