import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatContainer } from '@/components/chat/ChatContainer';
import * as chatApi from '@/lib/api/chat';
import * as storage from '@/lib/storage';

// APIモジュールのモック
vi.mock('@/lib/api/chat', () => ({
  createSession: vi.fn(),
  validateSession: vi.fn(),
  sendMessage: vi.fn(),
}));

// ストレージモジュールのモック
vi.mock('@/lib/storage', () => ({
  safeGetItem: vi.fn(),
  safeSetItem: vi.fn(),
  safeRemoveItem: vi.fn(),
}));

describe('ChatContainer', () => {
  const mockSessionId = '550e8400-e29b-41d4-a716-446655440000';
  const mockConversationId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのモック実装
    vi.mocked(storage.safeGetItem).mockReturnValue(null);
    vi.mocked(storage.safeSetItem).mockReturnValue(true);
    vi.mocked(storage.safeRemoveItem).mockReturnValue(true);
    vi.mocked(chatApi.createSession).mockResolvedValue({
      sessionId: mockSessionId,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('初期化', () => {
    it('初期化中はローディング表示される', async () => {
      // createSessionを遅延させる
      vi.mocked(chatApi.createSession).mockImplementation(
        () => new Promise(() => {}) // 解決しないPromise
      );

      render(<ChatContainer />);
      expect(screen.getByText('初期化中...')).toBeInTheDocument();
    });

    it('新規セッションを作成してローディングが消える', async () => {
      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      expect(chatApi.createSession).toHaveBeenCalled();
      expect(storage.safeSetItem).toHaveBeenCalledWith('ai-chat-session-id', mockSessionId);
    });

    it('既存の有効なセッションがある場合は再利用する', async () => {
      vi.mocked(storage.safeGetItem).mockReturnValue(mockSessionId);
      vi.mocked(chatApi.validateSession).mockResolvedValue({
        valid: true,
        sessionId: mockSessionId,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      expect(chatApi.validateSession).toHaveBeenCalledWith(mockSessionId);
      expect(chatApi.createSession).not.toHaveBeenCalled();
    });

    it('無効なセッションの場合は新規作成する', async () => {
      vi.mocked(storage.safeGetItem).mockReturnValue('invalid-session');
      vi.mocked(chatApi.validateSession).mockResolvedValue({
        valid: false,
        message: 'セッションが無効です',
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      expect(chatApi.validateSession).toHaveBeenCalledWith('invalid-session');
      expect(storage.safeRemoveItem).toHaveBeenCalledWith('ai-chat-session-id');
      expect(chatApi.createSession).toHaveBeenCalled();
    });

    it('セッション初期化エラー時にエラーメッセージを表示', async () => {
      vi.mocked(chatApi.createSession).mockRejectedValue(new Error('Network error'));

      render(<ChatContainer />);

      await waitFor(() => {
        expect(
          screen.getByText('セッションの初期化に失敗しました。ページを再読み込みしてください。')
        ).toBeInTheDocument();
      });
    });
  });

  describe('メッセージ送信', () => {
    beforeEach(async () => {
      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: 'こんにちは！何かお手伝いできますか？',
        conversationId: mockConversationId,
        sessionId: mockSessionId,
      });
    });

    it('メッセージを送信してAI応答を表示する', async () => {
      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      await userEvent.type(textarea, 'こんにちは');
      await userEvent.click(screen.getByRole('button', { name: '送信' }));

      // ユーザーメッセージが表示される
      await waitFor(() => {
        expect(screen.getByText('こんにちは')).toBeInTheDocument();
      });

      // AI応答が表示される
      await waitFor(() => {
        expect(screen.getByText('こんにちは！何かお手伝いできますか？')).toBeInTheDocument();
      });

      expect(chatApi.sendMessage).toHaveBeenCalledWith({
        message: 'こんにちは',
        sessionId: mockSessionId,
        conversationId: undefined,
      });
    });

    it('送信中はローディングが表示される', async () => {
      // sendMessageを遅延させる
      let resolveMessage: (value: chatApi.ChatResponse) => void;
      vi.mocked(chatApi.sendMessage).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveMessage = resolve;
          })
      );

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: 'テスト' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      // ローディングが表示される
      await waitFor(() => {
        expect(screen.getByText('考え中...')).toBeInTheDocument();
      });

      // メッセージを解決
      await act(async () => {
        resolveMessage!({
          response: '応答',
          conversationId: mockConversationId,
          sessionId: mockSessionId,
        });
      });

      // ローディングが消える
      await waitFor(() => {
        expect(screen.queryByText('考え中...')).not.toBeInTheDocument();
      });
    });

    it('2回目以降のメッセージでconversationIdが送信される', async () => {
      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');

      // 1回目のメッセージ
      fireEvent.change(textarea, { target: { value: 'メッセージ1' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(chatApi.sendMessage).toHaveBeenCalledWith({
          message: 'メッセージ1',
          sessionId: mockSessionId,
          conversationId: undefined,
        });
      });

      await waitFor(() => {
        expect(screen.getByText('こんにちは！何かお手伝いできますか？')).toBeInTheDocument();
      });

      // 2回目のメッセージ
      fireEvent.change(textarea, { target: { value: 'メッセージ2' } });

      // スロットル待機
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1100));
      });

      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(chatApi.sendMessage).toHaveBeenLastCalledWith({
          message: 'メッセージ2',
          sessionId: mockSessionId,
          conversationId: mockConversationId,
        });
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('メッセージ送信エラー時にエラーメッセージを表示', async () => {
      vi.mocked(chatApi.sendMessage).mockRejectedValue(new Error('送信に失敗しました'));

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: 'テスト' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(screen.getByText('送信に失敗しました')).toBeInTheDocument();
      });
    });

    it('エラー時にユーザーメッセージが削除される', async () => {
      vi.mocked(chatApi.sendMessage).mockRejectedValue(new Error('エラー'));

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: '失敗するメッセージ' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      // メッセージが一旦表示される
      await waitFor(() => {
        expect(screen.getByText('失敗するメッセージ')).toBeInTheDocument();
      });

      // エラー後にメッセージが削除される
      await waitFor(() => {
        expect(screen.queryByText('失敗するメッセージ')).not.toBeInTheDocument();
      });
    });

    it('エラー時に再送信ボタンが表示される', async () => {
      vi.mocked(chatApi.sendMessage).mockRejectedValue(new Error('エラー'));

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: 'テスト' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '再送信' })).toBeInTheDocument();
      });
    });

    it('再送信ボタンで失敗したメッセージを再送信できる', async () => {
      // 最初は失敗、2回目は成功
      vi.mocked(chatApi.sendMessage)
        .mockRejectedValueOnce(new Error('エラー'))
        .mockResolvedValueOnce({
          response: '成功しました',
          conversationId: mockConversationId,
          sessionId: mockSessionId,
        });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: 'リトライテスト' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      // エラー表示を待つ
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '再送信' })).toBeInTheDocument();
      });

      // 再送信
      fireEvent.click(screen.getByRole('button', { name: '再送信' }));

      // 成功した応答が表示される
      await waitFor(() => {
        expect(screen.getByText('成功しました')).toBeInTheDocument();
      });

      // エラーが消える
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: '再送信' })).not.toBeInTheDocument();
      });
    });
  });

  describe('UI状態', () => {
    it('ヘッダーが表示される', async () => {
      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { name: 'AIチャット' })).toBeInTheDocument();
    });

    it('初期状態でメッセージがない場合にプレースホルダーが表示される', async () => {
      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('メッセージを送信して会話を始めましょう')).toBeInTheDocument();
    });

    it('localStorageへの保存が失敗してもエラーにならない', async () => {
      vi.mocked(storage.safeSetItem).mockReturnValue(false);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      // エラー表示がないことを確認
      expect(
        screen.queryByText('セッションの初期化に失敗しました。ページを再読み込みしてください。')
      ).not.toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });
});
