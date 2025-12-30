import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testClient } from 'hono/testing';

// モックの設定（vi.mockはホイスティングされるため、vi.hoisted()で変数を定義）
const { mockCreateSession, mockValidateSession, mockGetSessionById } = vi.hoisted(() => ({
  mockCreateSession: vi.fn(),
  mockValidateSession: vi.fn(),
  mockGetSessionById: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  createSession: () => mockCreateSession(),
  validateSession: (sessionId: string) => mockValidateSession(sessionId),
  getSessionById: (sessionId: string) => mockGetSessionById(sessionId),
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
      create: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
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
    it('ステータスokを返す', async () => {
      const res = await client.api.health.$get();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ status: 'ok' });
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

    it('無効なセッションに対して401を返す', async () => {
      mockValidateSession.mockResolvedValue({
        valid: false,
        message: 'セッションが無効または期限切れです',
      });

      const res = await client.api.chat.$post({
        json: {
          message: 'こんにちは',
          sessionId: 'invalid-session',
        },
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('セッションが無効または期限切れです');
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
      const conversationId = 'existing-conversation-id';
      mockPrisma.conversation.findUnique.mockResolvedValue({
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
      mockPrisma.conversation.findUnique.mockResolvedValue(null);

      const res = await client.api.chat.$post({
        json: {
          message: 'こんにちは',
          sessionId: validSessionId,
          conversationId: 'non-existent-conversation',
        },
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('会話が見つかりません');
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
});
