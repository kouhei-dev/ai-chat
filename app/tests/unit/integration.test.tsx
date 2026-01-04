import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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

/**
 * セッション→メッセージ→レスポンスの統合テスト
 * ユーザーの典型的な操作フローをテスト
 */
describe('統合テスト: セッション→メッセージ→レスポンス', () => {
  const mockSessionId = '550e8400-e29b-41d4-a716-446655440000';
  const mockConversationId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.safeGetItem).mockReturnValue(null);
    vi.mocked(storage.safeSetItem).mockReturnValue(true);
    vi.mocked(storage.safeRemoveItem).mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('新規ユーザーフロー', () => {
    it('新規ユーザーがセッションを作成し、メッセージを送信し、応答を受け取る', async () => {
      // セッション作成のモック
      vi.mocked(chatApi.createSession).mockResolvedValue({
        sessionId: mockSessionId,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      // メッセージ送信のモック
      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: 'はい、何かお手伝いできることはありますか？',
        conversationId: mockConversationId,
        sessionId: mockSessionId,
      });

      render(<ChatContainer />);

      // Step 1: 初期化完了を待つ
      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      // セッションが作成されたことを確認
      expect(chatApi.createSession).toHaveBeenCalledTimes(1);
      expect(storage.safeSetItem).toHaveBeenCalledWith('ai-chat-session-id', mockSessionId);

      // Step 2: メッセージを送信
      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: 'こんにちは' } });
      fireEvent.click(screen.getByRole('button', { name: /メッセージを送信/ }));

      // Step 3: ユーザーメッセージが表示される
      await waitFor(() => {
        expect(screen.getByText('こんにちは')).toBeInTheDocument();
      });

      // Step 4: AI応答が表示される（ローディング表示のテストはChatContainer.test.tsxで実施）
      await waitFor(() => {
        expect(screen.getByText('はい、何かお手伝いできることはありますか？')).toBeInTheDocument();
      });

      // Step 5: ローディングが消える
      expect(screen.queryByText('考え中...')).not.toBeInTheDocument();

      // APIが正しく呼ばれたことを確認
      expect(chatApi.sendMessage).toHaveBeenCalledWith({
        message: 'こんにちは',
        sessionId: mockSessionId,
        conversationId: undefined,
      });
    });

    it('新規ユーザーが複数のメッセージをやり取りする', async () => {
      vi.mocked(chatApi.createSession).mockResolvedValue({
        sessionId: mockSessionId,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      // 最初の応答
      vi.mocked(chatApi.sendMessage)
        .mockResolvedValueOnce({
          response: '応答1',
          conversationId: mockConversationId,
          sessionId: mockSessionId,
        })
        .mockResolvedValueOnce({
          response: '応答2',
          conversationId: mockConversationId,
          sessionId: mockSessionId,
        })
        .mockResolvedValueOnce({
          response: '応答3',
          conversationId: mockConversationId,
          sessionId: mockSessionId,
        });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');

      // メッセージ1
      fireEvent.change(textarea, { target: { value: 'メッセージ1' } });
      fireEvent.click(screen.getByRole('button', { name: /メッセージを送信/ }));

      await waitFor(() => {
        expect(screen.getByText('応答1')).toBeInTheDocument();
      });

      // スロットル待機
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1100));
      });

      // メッセージ2
      fireEvent.change(textarea, { target: { value: 'メッセージ2' } });
      fireEvent.click(screen.getByRole('button', { name: /メッセージを送信/ }));

      await waitFor(() => {
        expect(screen.getByText('応答2')).toBeInTheDocument();
      });

      // スロットル待機
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1100));
      });

      // メッセージ3
      fireEvent.change(textarea, { target: { value: 'メッセージ3' } });
      fireEvent.click(screen.getByRole('button', { name: /メッセージを送信/ }));

      await waitFor(() => {
        expect(screen.getByText('応答3')).toBeInTheDocument();
      });

      // 全てのメッセージが表示されていることを確認
      expect(screen.getByText('メッセージ1')).toBeInTheDocument();
      expect(screen.getByText('メッセージ2')).toBeInTheDocument();
      expect(screen.getByText('メッセージ3')).toBeInTheDocument();
      expect(screen.getByText('応答1')).toBeInTheDocument();
      expect(screen.getByText('応答2')).toBeInTheDocument();
      expect(screen.getByText('応答3')).toBeInTheDocument();

      // 2回目以降はconversationIdが送信される
      expect(chatApi.sendMessage).toHaveBeenNthCalledWith(1, {
        message: 'メッセージ1',
        sessionId: mockSessionId,
        conversationId: undefined,
      });
      expect(chatApi.sendMessage).toHaveBeenNthCalledWith(2, {
        message: 'メッセージ2',
        sessionId: mockSessionId,
        conversationId: mockConversationId,
      });
      expect(chatApi.sendMessage).toHaveBeenNthCalledWith(3, {
        message: 'メッセージ3',
        sessionId: mockSessionId,
        conversationId: mockConversationId,
      });
    });
  });

  describe('既存ユーザーフロー', () => {
    it('既存セッションが有効な場合はセッションを再利用する', async () => {
      vi.mocked(storage.safeGetItem).mockReturnValue(mockSessionId);
      vi.mocked(chatApi.validateSession).mockResolvedValue({
        valid: true,
        sessionId: mockSessionId,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: '応答',
        conversationId: mockConversationId,
        sessionId: mockSessionId,
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      // 既存セッションの検証が行われる
      expect(chatApi.validateSession).toHaveBeenCalledWith(mockSessionId);
      // 新規セッションは作成されない
      expect(chatApi.createSession).not.toHaveBeenCalled();

      // メッセージ送信
      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: 'テスト' } });
      fireEvent.click(screen.getByRole('button', { name: /メッセージを送信/ }));

      await waitFor(() => {
        expect(screen.getByText('応答')).toBeInTheDocument();
      });

      // 既存のsessionIdが使用される
      expect(chatApi.sendMessage).toHaveBeenCalledWith({
        message: 'テスト',
        sessionId: mockSessionId,
        conversationId: undefined,
      });
    });

    it('セッションが期限切れの場合は新規作成する', async () => {
      const newSessionId = 'new-session-id-12345';

      vi.mocked(storage.safeGetItem).mockReturnValue(mockSessionId);
      vi.mocked(chatApi.validateSession).mockResolvedValue({
        valid: false,
        message: 'セッションが期限切れです',
      });
      vi.mocked(chatApi.createSession).mockResolvedValue({
        sessionId: newSessionId,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: '応答',
        conversationId: mockConversationId,
        sessionId: newSessionId,
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      // 古いセッションが削除される
      expect(storage.safeRemoveItem).toHaveBeenCalledWith('ai-chat-session-id');
      // 新しいセッションが作成される
      expect(chatApi.createSession).toHaveBeenCalled();
      // 新しいセッションが保存される
      expect(storage.safeSetItem).toHaveBeenCalledWith('ai-chat-session-id', newSessionId);

      // メッセージ送信
      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: 'テスト' } });
      fireEvent.click(screen.getByRole('button', { name: /メッセージを送信/ }));

      await waitFor(() => {
        expect(screen.getByText('応答')).toBeInTheDocument();
      });

      // 新しいsessionIdが使用される
      expect(chatApi.sendMessage).toHaveBeenCalledWith({
        message: 'テスト',
        sessionId: newSessionId,
        conversationId: undefined,
      });
    });
  });

  describe('エラーリカバリーフロー', () => {
    it('メッセージ送信失敗後にリトライで成功する', async () => {
      vi.mocked(chatApi.createSession).mockResolvedValue({
        sessionId: mockSessionId,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      // 最初は失敗、リトライで成功
      vi.mocked(chatApi.sendMessage)
        .mockRejectedValueOnce(new Error('ネットワークエラー'))
        .mockResolvedValueOnce({
          response: 'リトライ成功',
          conversationId: mockConversationId,
          sessionId: mockSessionId,
        });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: 'テストメッセージ' } });
      fireEvent.click(screen.getByRole('button', { name: /メッセージを送信/ }));

      // エラーが表示される
      await waitFor(() => {
        expect(screen.getByText('ネットワークエラー')).toBeInTheDocument();
      });

      // 再送信ボタンをクリック
      fireEvent.click(screen.getByRole('button', { name: /再送信/ }));

      // リトライ成功
      await waitFor(() => {
        expect(screen.getByText('リトライ成功')).toBeInTheDocument();
      });

      // エラーが消える
      expect(screen.queryByText('ネットワークエラー')).not.toBeInTheDocument();
    });

    it('セッション作成失敗後にページリロードで回復できる（メッセージ表示）', async () => {
      vi.mocked(chatApi.createSession).mockRejectedValue(new Error('サーバーエラー'));

      render(<ChatContainer />);

      await waitFor(() => {
        expect(
          screen.getByText('セッションの初期化に失敗しました。ページを再読み込みしてください。')
        ).toBeInTheDocument();
      });

      // エラーメッセージが正しく表示されることを確認
      // （実際のリロードはテストできないが、メッセージでユーザーに案内）
    });
  });
});
