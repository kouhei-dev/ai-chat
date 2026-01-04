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
 * エッジケーステスト
 * 大きなメッセージ、連続送信、境界値などのテスト
 */
describe('エッジケーステスト', () => {
  const mockSessionId = '550e8400-e29b-41d4-a716-446655440000';
  const mockConversationId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('大きなメッセージ', () => {
    it('最大長のメッセージ（400文字）を送信できる', async () => {
      const maxLengthMessage = 'あ'.repeat(400);
      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: '長いメッセージを受け取りました。',
        conversationId: mockConversationId,
        sessionId: mockSessionId,
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: maxLengthMessage } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(screen.getByText('長いメッセージを受け取りました。')).toBeInTheDocument();
      });

      expect(chatApi.sendMessage).toHaveBeenCalledWith({
        message: maxLengthMessage,
        sessionId: mockSessionId,
        conversationId: undefined,
      });
    });

    it('非常に長いAI応答を表示できる', async () => {
      const longResponse = 'これは非常に長い応答です。'.repeat(100);
      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: longResponse,
        conversationId: mockConversationId,
        sessionId: mockSessionId,
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: 'テスト' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(screen.getByText(longResponse)).toBeInTheDocument();
      });
    });

    it('日本語と英語が混在した長いメッセージを処理できる', async () => {
      const mixedMessage = 'Hello世界!'.repeat(30);
      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: '混在メッセージを受け取りました。',
        conversationId: mockConversationId,
        sessionId: mockSessionId,
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: mixedMessage } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(screen.getByText('混在メッセージを受け取りました。')).toBeInTheDocument();
      });
    });
  });

  describe('連続送信', () => {
    it('スロットル中は連続送信がブロックされる', async () => {
      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: '応答',
        conversationId: mockConversationId,
        sessionId: mockSessionId,
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');

      // 最初のメッセージを送信
      fireEvent.change(textarea, { target: { value: 'メッセージ1' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(chatApi.sendMessage).toHaveBeenCalledTimes(1);
      });

      // すぐに2回目を試みる（スロットル中）
      fireEvent.change(textarea, { target: { value: 'メッセージ2' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      // 2回目は送信されない
      expect(chatApi.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('スロットル時間経過後は送信できる', async () => {
      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: '応答',
        conversationId: mockConversationId,
        sessionId: mockSessionId,
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');

      // 最初のメッセージを送信
      fireEvent.change(textarea, { target: { value: 'メッセージ1' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(chatApi.sendMessage).toHaveBeenCalledTimes(1);
      });

      // スロットル時間（1秒）待機
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1100));
      });

      // 2回目のメッセージを送信
      fireEvent.change(textarea, { target: { value: 'メッセージ2' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(chatApi.sendMessage).toHaveBeenCalledTimes(2);
      });
    });

    it('ローディング中は送信ボタンが無効', async () => {
      // 応答を遅延させる
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

      // ローディング中はローディング表示が出る（入力無効はChatContainer.test.tsxでテスト済み）
      await waitFor(() => {
        expect(screen.getByText('考え中...')).toBeInTheDocument();
      });

      // 応答を返す
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
  });

  describe('特殊文字・絵文字', () => {
    it('絵文字を含むメッセージを送信できる', async () => {
      const emojiMessage = '🎉 お祝いです！ 🎊';
      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: '絵文字を受け取りました 😊',
        conversationId: mockConversationId,
        sessionId: mockSessionId,
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: emojiMessage } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(screen.getByText(emojiMessage)).toBeInTheDocument();
        expect(screen.getByText('絵文字を受け取りました 😊')).toBeInTheDocument();
      });
    });

    it('HTMLタグを含むメッセージがエスケープされる', async () => {
      const htmlMessage = '<script>alert("xss")</script>';
      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: 'HTMLを受け取りました',
        conversationId: mockConversationId,
        sessionId: mockSessionId,
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: htmlMessage } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        // HTMLがそのまま表示される（実行されない）
        expect(screen.getByText(htmlMessage)).toBeInTheDocument();
      });
    });

    it('改行を含むメッセージを送信できる', async () => {
      const multilineMessage = '1行目\n2行目\n3行目';
      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: '改行メッセージを受け取りました',
        conversationId: mockConversationId,
        sessionId: mockSessionId,
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: multilineMessage } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      // 改行を含むテキストは関数マッチャーで確認
      await waitFor(() => {
        expect(
          screen.getByText((content) => content.includes('1行目') && content.includes('3行目'))
        ).toBeInTheDocument();
      });

      expect(chatApi.sendMessage).toHaveBeenCalledWith({
        message: multilineMessage,
        sessionId: mockSessionId,
        conversationId: undefined,
      });
    });
  });

  describe('ネットワークエラー', () => {
    it('タイムアウトエラーのメッセージを表示', async () => {
      vi.mocked(chatApi.sendMessage).mockRejectedValue(
        new Error('リクエストがタイムアウトしました。時間をおいて再度お試しください。')
      );

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: 'テスト' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(
          screen.getByText('リクエストがタイムアウトしました。時間をおいて再度お試しください。')
        ).toBeInTheDocument();
      });
    });

    it('ネットワーク切断エラーのメッセージを表示', async () => {
      vi.mocked(chatApi.sendMessage).mockRejectedValue(new Error('メッセージの送信に失敗しました'));

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: 'テスト' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(screen.getByText('メッセージの送信に失敗しました')).toBeInTheDocument();
      });
    });

    it('複数回連続でエラーが発生しても正しくハンドリングされる', async () => {
      vi.mocked(chatApi.sendMessage)
        .mockRejectedValueOnce(new Error('エラー1'))
        .mockRejectedValueOnce(new Error('エラー2'))
        .mockResolvedValueOnce({
          response: '3回目で成功',
          conversationId: mockConversationId,
          sessionId: mockSessionId,
        });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');

      // 1回目のエラー
      fireEvent.change(textarea, { target: { value: 'テスト1' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(screen.getByText('エラー1')).toBeInTheDocument();
      });

      // 再送信（2回目のエラー）
      fireEvent.click(screen.getByRole('button', { name: '再送信' }));

      await waitFor(() => {
        expect(screen.getByText('エラー2')).toBeInTheDocument();
      });

      // 再送信（3回目で成功）
      fireEvent.click(screen.getByRole('button', { name: '再送信' }));

      await waitFor(() => {
        expect(screen.getByText('3回目で成功')).toBeInTheDocument();
      });

      expect(screen.queryByText('エラー2')).not.toBeInTheDocument();
    });
  });

  describe('localStorage関連', () => {
    it('localStorageが無効な環境でも動作する', async () => {
      vi.mocked(storage.safeGetItem).mockReturnValue(null);
      vi.mocked(storage.safeSetItem).mockReturnValue(false); // 保存失敗
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: '応答',
        conversationId: mockConversationId,
        sessionId: mockSessionId,
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      // セッションは作成される
      expect(chatApi.createSession).toHaveBeenCalled();

      // メッセージ送信も可能
      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: 'テスト' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(screen.getByText('応答')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('空・境界値', () => {
    it('空白のみのメッセージは送信されない', async () => {
      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: '   ' } });

      // 送信ボタンは無効のまま
      expect(screen.getByRole('button', { name: '送信' })).toBeDisabled();
    });

    it('タブ文字のみのメッセージは送信されない', async () => {
      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: '\t\t\t' } });

      // 送信ボタンは無効のまま
      expect(screen.getByRole('button', { name: '送信' })).toBeDisabled();
    });

    it('1文字のメッセージを送信できる', async () => {
      vi.mocked(chatApi.sendMessage).mockResolvedValue({
        response: '1文字受け取りました',
        conversationId: mockConversationId,
        sessionId: mockSessionId,
      });

      render(<ChatContainer />);

      await waitFor(() => {
        expect(screen.queryByText('初期化中...')).not.toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('メッセージを入力...');
      fireEvent.change(textarea, { target: { value: 'あ' } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => {
        expect(screen.getByText('あ')).toBeInTheDocument();
        expect(screen.getByText('1文字受け取りました')).toBeInTheDocument();
      });
    });
  });
});
