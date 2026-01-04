import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSession,
  validateSession,
  sendMessage,
  SessionResponse,
  SessionValidationResponse,
  ChatResponse,
  DEFAULT_TIMEOUT,
  CHAT_TIMEOUT,
} from '@/lib/api/chat';

// fetchのモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('chat.ts API Client', () => {
  let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setTimeoutSpy = vi.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    vi.useRealTimers();
    setTimeoutSpy.mockRestore();
  });

  describe('fetchWithTimeout', () => {
    it('正常なレスポンスを返す', async () => {
      const mockSessionResponse: SessionResponse = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        expiresAt: '2024-01-02T12:00:00.000Z',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockSessionResponse)),
      });

      const promise = createSession();
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(mockSessionResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/session',
        expect.objectContaining({
          method: 'POST',
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('タイムアウト時にエラーメッセージを返す', async () => {
      // AbortErrorを発生させる
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const promise = createSession();

      // rejectionハンドラーを先に登録してから、タイマーを進める
      const expectPromise = expect(promise).rejects.toThrow(
        'リクエストがタイムアウトしました。時間をおいて再度お試しください。'
      );
      await vi.runAllTimersAsync();
      await expectPromise;
    });

    it('ネットワークエラーをそのまま伝播する', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValue(networkError);

      const promise = createSession();

      // rejectionハンドラーを先に登録してから、タイマーを進める
      const expectPromise = expect(promise).rejects.toThrow('Network error');
      await vi.runAllTimersAsync();
      await expectPromise;
    });
  });

  describe('createSession', () => {
    it('新規セッションを作成する', async () => {
      const mockSessionResponse: SessionResponse = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        expiresAt: '2024-01-02T12:00:00.000Z',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockSessionResponse)),
      });

      const promise = createSession();
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.expiresAt).toBe('2024-01-02T12:00:00.000Z');
    });

    it('DEFAULT_TIMEOUTを使用する', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              sessionId: 'test',
              expiresAt: '2024-01-01',
            })
          ),
      });

      const promise = createSession();
      await vi.runAllTimersAsync();
      await promise;

      // setTimeoutがDEFAULT_TIMEOUTで呼ばれていることを確認
      const timeoutCalls = setTimeoutSpy.mock.calls;
      const timeoutValues = timeoutCalls.map((call) => call[1]);
      expect(timeoutValues).toContain(DEFAULT_TIMEOUT);
    });

    it('APIエラー時に例外を投げる', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ error: 'サーバーエラー' })),
      });

      const promise = createSession();

      const expectPromise = expect(promise).rejects.toThrow('サーバーエラー');
      await vi.runAllTimersAsync();
      await expectPromise;
    });

    it('エラーメッセージが無い場合デフォルトメッセージを表示', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({})),
      });

      const promise = createSession();

      const expectPromise = expect(promise).rejects.toThrow('セッションの作成に失敗しました');
      await vi.runAllTimersAsync();
      await expectPromise;
    });
  });

  describe('validateSession', () => {
    it('有効なセッションを検証する', async () => {
      const mockValidationResponse: SessionValidationResponse = {
        valid: true,
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        expiresAt: '2024-01-02T12:00:00.000Z',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockValidationResponse)),
      });

      const promise = validateSession('550e8400-e29b-41d4-a716-446655440000');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.valid).toBe(true);
      expect(result.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('DEFAULT_TIMEOUTを使用する', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              valid: true,
              sessionId: 'test',
              expiresAt: '2024-01-01',
            })
          ),
      });

      const promise = validateSession('test-session');
      await vi.runAllTimersAsync();
      await promise;

      // setTimeoutがDEFAULT_TIMEOUTで呼ばれていることを確認
      const timeoutCalls = setTimeoutSpy.mock.calls;
      const timeoutValues = timeoutCalls.map((call) => call[1]);
      expect(timeoutValues).toContain(DEFAULT_TIMEOUT);
    });

    it('無効なセッションの場合valid=falseを返す', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ error: 'セッションが期限切れです' })),
      });

      const promise = validateSession('expired-session');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.valid).toBe(false);
      expect(result.message).toBe('セッションが期限切れです');
    });

    it('エラーメッセージが無い場合デフォルトメッセージを表示', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({})),
      });

      const promise = validateSession('invalid-session');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.valid).toBe(false);
      expect(result.message).toBe('セッションの検証に失敗しました');
    });
  });

  describe('sendMessage', () => {
    it('メッセージを送信してAI応答を受け取る', async () => {
      const mockChatResponse: ChatResponse = {
        response: 'こんにちは！何かお手伝いできることはありますか？',
        conversationId: 'conv-123',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockChatResponse)),
      });

      const promise = sendMessage({
        message: 'こんにちは',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
      });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.response).toBe('こんにちは！何かお手伝いできることはありますか？');
      expect(result.conversationId).toBe('conv-123');
    });

    it('CHAT_TIMEOUTを使用する（AI応答待ちを考慮した長めのタイムアウト）', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              response: 'テスト応答',
              conversationId: 'conv-123',
              sessionId: 'session-id',
            })
          ),
      });

      const promise = sendMessage({
        message: 'テスト',
        sessionId: 'session-id',
      });
      await vi.runAllTimersAsync();
      await promise;

      // setTimeoutがCHAT_TIMEOUTで呼ばれていることを確認
      const timeoutCalls = setTimeoutSpy.mock.calls;
      const timeoutValues = timeoutCalls.map((call) => call[1]);
      expect(timeoutValues).toContain(CHAT_TIMEOUT);
    });

    it('APIエラー時に例外を投げる', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ error: 'メッセージの処理に失敗しました' })),
      });

      const promise = sendMessage({
        message: 'テスト',
        sessionId: 'session-id',
      });

      const expectPromise = expect(promise).rejects.toThrow('メッセージの処理に失敗しました');
      await vi.runAllTimersAsync();
      await expectPromise;
    });

    it('タイムアウト時にエラーメッセージを返す', async () => {
      // AbortErrorを発生させてタイムアウトをシミュレート
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const promise = sendMessage({
        message: 'テスト',
        sessionId: 'session-id',
      });

      const expectPromise = expect(promise).rejects.toThrow(
        'リクエストがタイムアウトしました。時間をおいて再度お試しください。'
      );
      await vi.runAllTimersAsync();
      await expectPromise;
    });

    it('会話IDを含めてリクエストを送信できる', async () => {
      const mockChatResponse: ChatResponse = {
        response: '続きの応答です',
        conversationId: 'conv-123',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockChatResponse)),
      });

      const _promise = sendMessage({
        message: '続き',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: 'conv-123',
      });
      await vi.runAllTimersAsync();
      await _promise;

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            message: '続き',
            sessionId: '550e8400-e29b-41d4-a716-446655440000',
            conversationId: 'conv-123',
          }),
        })
      );
    });
  });

  describe('AbortController integration', () => {
    it('リクエストにAbortSignalを渡す', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              sessionId: 'test',
              expiresAt: '2024-01-01',
            })
          ),
      });

      const _promise = createSession();
      await vi.runAllTimersAsync();
      await _promise;

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/session',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  describe('タイムアウト値の検証', () => {
    it('DEFAULT_TIMEOUTとCHAT_TIMEOUTは異なる値である', () => {
      expect(DEFAULT_TIMEOUT).not.toBe(CHAT_TIMEOUT);
      expect(CHAT_TIMEOUT).toBeGreaterThan(DEFAULT_TIMEOUT);
    });
  });
});
